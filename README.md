# 从cloudflare上传文件到github仓库
这是一个测试项目, 测试地址: https://image.ngapp.net/
可以直接把图片上传到此仓库, 也可以通过 https://image.ngapp.net/ 获取此仓库的图片

# 使用方法

1. 创建一个github仓库
2. 在github的设置中找到 [https://github.com/settings/tokens/new](https://github.com/settings/tokens/new) 生成一个token, 并在 Select scopes 中勾选 repo
3. 复制  wrangle.example.jsonc 到 wrangle.jsonc
4. 修改 wrangle.jsonc 文件中的仓库信息和token
5. 运行 npm run dev 就可以本地测试了
