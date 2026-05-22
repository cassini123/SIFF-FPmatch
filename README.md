# 2025SIFF排班助手
dist-package/
├── README.md        # 使用说明
├── server.js        # Node.js 服务器
├── start.bat        # Windows 启动脚本
├── start.sh         # Mac/Linux 启动脚本
├── index.html       # 主页面
└── assets/          # 静态资源 (JS/CSS)

使用方法
Windows:
双击运行 start.bat

Mac/Linux:
chmod +x start.sh
./start.sh

或手动启动:
cd dist-package
node server.js

然后访问 http://localhost:5000
系统要求
Node.js 14+ 已安装



[**项目地址**](https://space.coze.cn/task/7507093572345626676)

## 本地开发

### 环境准备

- 安装 [Node.js](https://nodejs.org/en)
- 安装 [pnpm](https://pnpm.io/installation)

### 操作步骤

- 安装依赖

```sh
pnpm install
```

- 启动 Dev Server

```sh
pnpm run dev
```

- 在浏览器访问 http://localhost:3000

