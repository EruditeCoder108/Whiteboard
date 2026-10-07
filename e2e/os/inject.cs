// OS-level input injector for end-to-end tests (mouse, multi-touch, pen with pressure, keys).
// Usage:  inject.exe "m 500 400; md; w 50; m 600 450; mu"      (coordinates are physical pixels)
//
//   m x y            move the mouse            md / mu        left button down / up
//   rd / ru          right button down / up    wheel n        wheel clicks (+ up)
//   t id x y d|m|u   touch contact (down / move / up); several ids may be active at once
//   p x y pr d|m|u   pen contact, pressure 0..1024 (d = down, m = move, u = up, h = hover)
//   k combo          key combo, e.g. "ctrl+shift+space"
//   w ms             wait
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

static class P
{
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern void mouse_event(uint f, int dx, int dy, int d, UIntPtr e);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll", SetLastError = true)] static extern bool InitializeTouchInjection(uint max, uint mode);
    [DllImport("user32.dll", SetLastError = true)] static extern bool InjectTouchInput(uint count, [In] POINTER_TOUCH_INFO[] contacts);
    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr CreateSyntheticPointerDevice(uint type, uint maxCount, uint mode);
    [DllImport("user32.dll", SetLastError = true)] static extern bool InjectSyntheticPointerInput(IntPtr dev, [In] POINTER_TYPE_INFO[] info, uint count);

    [StructLayout(LayoutKind.Sequential)] struct POINT { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int left, top, right, bottom; }
    [StructLayout(LayoutKind.Sequential)]
    struct POINTER_INFO
    {
        public uint pointerType, pointerId, frameId, pointerFlags;
        public IntPtr sourceDevice, hwndTarget;
        public POINT ptPixelLocation, ptHimetricLocation, ptPixelLocationRaw, ptHimetricLocationRaw;
        public uint dwTime, historyCount;
        public int InputData;
        public uint dwKeyStates;
        public ulong PerformanceCount;
        public uint ButtonChangeType;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct POINTER_TOUCH_INFO
    {
        public POINTER_INFO pointerInfo;
        public uint touchFlags, touchMask;
        public RECT rcContact, rcContactRaw;
        public uint orientation, pressure;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct POINTER_PEN_INFO
    {
        public POINTER_INFO pointerInfo;
        public uint penFlags, penMask, pressure, rotation;
        public int tiltX, tiltY;
    }
    [StructLayout(LayoutKind.Explicit)]
    struct POINTER_TYPE_INFO
    {
        [FieldOffset(0)] public uint type;
        [FieldOffset(8)] public POINTER_PEN_INFO penInfo;
    }

    const uint NEW = 0x1, INRANGE = 0x2, INCONTACT = 0x4, FIRSTBTN = 0x10, DOWN = 0x10000, UPDATE = 0x20000, UP = 0x40000;
    static readonly Dictionary<uint, POINT> touches = new Dictionary<uint, POINT>();
    static IntPtr penDev = IntPtr.Zero;
    static bool penIsDown = false;
    static int penX, penY;
    static uint penPr;

    static void Touch(uint id, int x, int y, char what)
    {
        if (what == 'd') touches[id] = new POINT { x = x, y = y };
        else if (what == 'm') touches[id] = new POINT { x = x, y = y };
        var list = new List<POINTER_TOUCH_INFO>();
        foreach (var kv in touches)
        {
            bool me = kv.Key == id;
            uint flags = INRANGE | INCONTACT;
            if (me && what == 'd') flags |= DOWN;
            else if (me && what == 'u') flags = UP;
            else flags |= UPDATE;
            var pt = (me && what == 'u') ? new POINT { x = x, y = y } : kv.Value;
            var ti = new POINTER_TOUCH_INFO();
            ti.pointerInfo.pointerType = 2;
            ti.pointerInfo.pointerId = kv.Key;
            ti.pointerInfo.pointerFlags = flags;
            ti.pointerInfo.ptPixelLocation = pt;
            ti.touchFlags = 0;
            ti.touchMask = 1 | 2 | 4;
            ti.rcContact = new RECT { left = pt.x - 3, right = pt.x + 3, top = pt.y - 3, bottom = pt.y + 3 };
            ti.orientation = 90;
            ti.pressure = 32000;
            list.Add(ti);
        }
        if (!InjectTouchInput((uint)list.Count, list.ToArray()))
            Console.Error.WriteLine("InjectTouchInput failed " + Marshal.GetLastWin32Error());
        if (what == 'u') touches.Remove(id);
    }

    static void Pen(int x, int y, uint pressure, char what)
    {
        if (what == 'd' || what == 'm') { penIsDown = true; penX = x; penY = y; penPr = pressure; }
        else if (what == 'u') penIsDown = false;
        if (penDev == IntPtr.Zero)
        {
            penDev = CreateSyntheticPointerDevice(3, 1, 1);
            if (penDev == IntPtr.Zero) { Console.Error.WriteLine("CreateSyntheticPointerDevice failed " + Marshal.GetLastWin32Error()); return; }
        }
        var info = new POINTER_TYPE_INFO { type = 3 };
        info.penInfo.pointerInfo.pointerType = 3;
        info.penInfo.pointerInfo.pointerId = 1;
        info.penInfo.pointerInfo.ptPixelLocation = new POINT { x = x, y = y };
        uint f = INRANGE;
        if (what == 'd') f |= DOWN | INCONTACT | FIRSTBTN;
        else if (what == 'm') f |= UPDATE | INCONTACT | FIRSTBTN;
        else if (what == 'u') f = UP | INRANGE;
        else f |= UPDATE;                                   // hover
        info.penInfo.pointerInfo.pointerFlags = f;
        info.penInfo.penMask = 1;                            // pressure valid
        info.penInfo.pressure = (what == 'h' || what == 'u') ? 0u : pressure;
        if (!InjectSyntheticPointerInput(penDev, new[] { info }, 1))
            Console.Error.WriteLine("InjectSyntheticPointerInput failed " + Marshal.GetLastWin32Error());
    }

    static readonly Dictionary<string, byte> keys = new Dictionary<string, byte> {
        {"ctrl",0x11},{"shift",0x10},{"alt",0x12},{"space",0x20},{"h",0x48},{"p",0x50},{"z",0x5A},{"esc",0x1B},{"tab",0x09}
    };
    static void Keys(string combo)
    {
        var parts = combo.Split('+');
        foreach (var p in parts) keybd_event(keys[p], 0, 0, UIntPtr.Zero);
        Thread.Sleep(40);
        for (int i = parts.Length - 1; i >= 0; i--) keybd_event(keys[parts[i]], 0, 2, UIntPtr.Zero);
    }

    static void Run(string script)
    {
        foreach (var raw in script.Split(';'))
        {
            var a = raw.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (a.Length == 0) continue;
            switch (a[0])
            {
                case "m": SetCursorPos(int.Parse(a[1]), int.Parse(a[2])); break;
                case "md": mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero); break;
                case "mu": mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero); break;
                case "rd": mouse_event(0x0008, 0, 0, 0, UIntPtr.Zero); break;
                case "ru": mouse_event(0x0010, 0, 0, 0, UIntPtr.Zero); break;
                case "wheel": mouse_event(0x0800, 0, 0, int.Parse(a[1]) * 120, UIntPtr.Zero); break;
                case "t": Touch(uint.Parse(a[1]), int.Parse(a[2]), int.Parse(a[3]), a[4][0]); break;
                case "p": Pen(int.Parse(a[1]), int.Parse(a[2]), uint.Parse(a[3]), a[4][0]); break;
                case "k": Keys(a[1]); break;
                case "w": Wait(int.Parse(a[1])); break;
            }
        }
    }

    static int Main(string[] args)
    {
        SetProcessDPIAware();
        InitializeTouchInjection(10, 1);
        if (args.Length > 0 && args[0] == "--server")
        {
            // stay alive so touch / pen contacts persist between commands
            string line;
            while ((line = Console.In.ReadLine()) != null)
            {
                try { Run(line); Console.WriteLine("OK"); }
                catch (Exception e) { Console.WriteLine("ERR " + e.Message); }
            }
            return 0;
        }
        Run(string.Join(" ", args));
        return 0;
    }
}