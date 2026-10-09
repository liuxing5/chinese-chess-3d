#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地静态服务器：强制正确的 MIME 类型（修复 Windows 下 .js 被当 text/plain 导致模块加载失败）。"""
import http.server
import socketserver
import mimetypes

# 关键：纠正 Windows 注册表里 .js 被错配成 text/plain 的问题
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('image/x-icon', '.ico')
mimetypes.add_type('text/css', '.css')

PORT = 8765
DIRECTORY = '.'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)


def main():
    with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
        print(f'楚汉风云 · 三维象棋  →  http://127.0.0.1:{PORT}/')
        print('按 Ctrl+C 停止')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n已停止。')


if __name__ == '__main__':
    main()
