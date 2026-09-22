import ctypes
import os

cairo = ctypes.CDLL('libcairo.so.2')
rsvg = ctypes.CDLL('librsvg-2.so.2')
gobject = ctypes.CDLL('libgobject-2.0.so.0')

# Setup types
rsvg.rsvg_handle_new_from_file.argtypes = [ctypes.c_char_p, ctypes.c_void_p]
rsvg.rsvg_handle_new_from_file.restype = ctypes.c_void_p

cairo.cairo_image_surface_create.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
cairo.cairo_image_surface_create.restype = ctypes.c_void_p

cairo.cairo_create.argtypes = [ctypes.c_void_p]
cairo.cairo_create.restype = ctypes.c_void_p

cairo.cairo_scale.argtypes = [ctypes.c_void_p, ctypes.c_double, ctypes.c_double]
cairo.cairo_scale.restype = None

rsvg.rsvg_handle_render_cairo.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
rsvg.rsvg_handle_render_cairo.restype = ctypes.c_bool

cairo.cairo_surface_write_to_png.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
cairo.cairo_surface_write_to_png.restype = ctypes.c_int

cairo.cairo_destroy.argtypes = [ctypes.c_void_p]
cairo.cairo_surface_destroy.argtypes = [ctypes.c_void_p]
gobject.g_object_unref.argtypes = [ctypes.c_void_p]


def render_svg_to_png(svg_path: str, png_path: str, target_width: int, target_height: int, original_width: int, original_height: int):
    handle = rsvg.rsvg_handle_new_from_file(svg_path.encode('utf-8'), None)
    if not handle:
        raise RuntimeError(f"Failed to load SVG: {svg_path}")

    surface = cairo.cairo_image_surface_create(0, target_width, target_height)  # 0 = CAIRO_FORMAT_ARGB32
    cr = cairo.cairo_create(surface)

    scale_x = target_width / original_width
    scale_y = target_height / original_height
    cairo.cairo_scale(cr, scale_x, scale_y)

    rsvg.rsvg_handle_render_cairo(handle, cr)
    status = cairo.cairo_surface_write_to_png(surface, png_path.encode('utf-8'))
    if status != 0:
        raise RuntimeError(f"Failed to write PNG: {png_path} (status={status})")

    cairo.cairo_destroy(cr)
    cairo.cairo_surface_destroy(surface)
    gobject.g_object_unref(handle)
    print(f"Generated {png_path} ({target_width}x{target_height}) from {svg_path}")


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(base_dir, 'public')

    icons = [
        ('pwa-192.svg', 'pwa-192.png', 192, 192, 192, 192),
        ('pwa-512.svg', 'pwa-512.png', 512, 512, 512, 512),
        ('pwa-maskable.svg', 'pwa-maskable.png', 512, 512, 512, 512),
        ('pwa-512.svg', 'apple-touch-icon.png', 180, 180, 512, 512),
        ('pwa-192.svg', 'favicon-32x32.png', 32, 32, 192, 192),
        ('pwa-192.svg', 'favicon-16x16.png', 16, 16, 192, 192),
    ]

    for svg_file, png_file, tw, th, ow, oh in icons:
        svg_path = os.path.join(public_dir, svg_file)
        png_path = os.path.join(public_dir, png_file)
        render_svg_to_png(svg_path, png_path, tw, th, ow, oh)

    print("All PNG icons generated successfully!")


if __name__ == '__main__':
    main()
