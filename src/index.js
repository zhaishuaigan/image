
export default {

    getChinaTime() {
        return new Date(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))
    },
    getTime() {
        var date = this.getChinaTime();
        var dateObj = {
            year: date.getFullYear(),
            month: (date.getMonth() + 1),
            day: date.getDate(),
            week: date.getDay(),
            hour: date.getHours(),
            minute: date.getMinutes(),
            second: date.getSeconds(),
            millisecond: date.getMilliseconds(),
        };
        return {
            ...dateObj,
            formatYearMonth: dateObj.year + '-' + dateObj.month.toString().padStart(2, '0'),
            formatDate: dateObj.year + '-' + dateObj.month.toString().padStart(2, '0') + '-' + dateObj.day,
            formatTime: dateObj.hour.toString().padStart(2, '0') + ':' + dateObj.minute.toString().padStart(2, '0') + ':' + dateObj.second.toString().padStart(2, '0'),
            formatDateTime: dateObj.year + '-' + dateObj.month.toString().padStart(2, '0') + '-' + dateObj.day + ' ' + dateObj.hour.toString().padStart(2, '0') + ':' + dateObj.minute.toString().padStart(2, '0') + ':' + dateObj.second.toString().padStart(2, '0'),
        }
    },
    async fetch(request, env, ctx) {
        if (request.url.includes("/time")) {
            return new Response(
                JSON.stringify({
                    1: this.getTime().formatDateTime,
                    2: Date.now()
                }), {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                },
            })
        }
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            })

        }

        const githubOwner = env.GITHUB_OWNER || "your-username"
        const githubRepo = env.GITHUB_REPO || "image-storage"
        const githubBranch = env.GITHUB_BRANCH || "main"

        if (!request.url.includes("/upload")) {
            var url = new URL(request.url);
            var filename = url.pathname;
            var domain = 'https://raw.githubusercontent.com';
            var downloadUrl = `${domain}/${githubOwner}/${githubRepo}/${githubBranch}${filename}`;
            return fetch(downloadUrl);
        }
        try {

            const formData = await request.formData()
            const file = formData.get("image")

            if (!file) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: "请选择要上传的图片",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                )
            }

            // 验证文件类型
            if (!file.type.startsWith("image/")) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: "只支持图片文件",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                )
            }

            // 验证文件大小 (10MB)
            if (file.size > 10 * 1024 * 1024) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: "文件大小不能超过10MB",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                )
            }

            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            const base64Content = btoa(String.fromCharCode(...uint8Array))

            // 生成文件名
            const timestamp = Date.now()
            const extension = file.name.split(".").pop() || "jpg"
            var date = this.getTime().formatYearMonth;
            const fileName = `${date}/${timestamp}.${extension}`

            // 上传到GitHub
            const githubResponse = await fetch(
                `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${fileName}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `token ${env.GITHUB_TOKEN}`,
                        "Content-Type": "application/json",
                        "User-Agent": "Cloudflare-Workers",
                    },
                    body: JSON.stringify({
                        message: `Upload image: ${fileName}`,
                        content: base64Content,
                        branch: githubBranch,
                    }),
                },
            )

            if (!githubResponse.ok) {
                const errorData = await githubResponse.json()
                console.error("GitHub API Error:", errorData)
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: `GitHub上传失败: ${errorData.message || "未知错误"}`,
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                )
            }

            const githubData = await githubResponse.json()

            // 构建图片URL
            // const imageUrl = `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/${fileName}`
            const imageUrl = request.url.replace('/upload', '/' + fileName);
            return new Response(
                JSON.stringify({
                    success: true,
                    url: imageUrl,
                    downloadUrl: imageUrl,
                    message: "图片上传成功",
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type",
                    },
                },
            )
        } catch (error) {
            console.error("Upload error:", error)
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "服务器内部错误",
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                },
            )
        }
    }
}