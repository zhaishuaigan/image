
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

        const githubToken = env.GITHUB_TOKEN || "your-token"
        const githubOwner = env.GITHUB_OWNER || "your-username"
        const githubRepo = env.GITHUB_REPO || "image-storage"
        const githubBranch = env.GITHUB_BRANCH || "main"

        if (!request.url.includes("/upload")) {
            var url = new URL(request.url);
            var filename = url.pathname;
            var domain = 'https://raw.githubusercontent.com';
            var downloadUrl = `${domain}/${githubOwner}/${githubRepo}/${githubBranch}${filename}`;
            var request = new Request(downloadUrl);
            return this.fetchAndCache(request, 3600);
        }
        try {

            const formData = await request.formData()
            const file = formData.get("image")

            if (!file) {
                return this.errorResponse("请选择要上传的图片", 400);
            }

            // 验证文件类型
            if (!file.type.startsWith("image/")) {
                return this.errorResponse("只支持图片文件", 400);
            }

            // 验证文件大小 (10MB)
            if (file.size > 10 * 1024 * 1024) {
                return this.errorResponse("文件大小不能超过10MB", 400);
            }

            // 生成文件名
            const timestamp = Date.now()
            const extension = file.name.split(".").pop() || "jpg"
            var date = this.getTime().formatYearMonth;
            const fileName = `${date}/${timestamp}.${extension}`;

            console.log("Uploading file:", fileName);
            await this.uploadToGitHub(file, githubToken, githubOwner, githubRepo, githubBranch, fileName);
            console.log("Upload success");

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
            return this.errorResponse("服务器内部错误");
        }
    },

    uploadToGitHub: async function (file, token, githubOwner, githubRepo, githubBranch, fileName) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        // 使用分块处理避免调用栈溢出
        const CHUNK_SIZE = 65536;
        let binary = '';
        for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
            const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
            binary += String.fromCharCode(...chunk);
        }
        const base64Content = btoa(binary);

        var githubUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${fileName}`
        // 上传到GitHub
        const githubResponse = await fetch(githubUrl,
            {
                method: "PUT",
                headers: {
                    Authorization: `token ${token}`,
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
            console.error("GitHub API Error:", errorData);
            throw new Error(`GitHub API Error: ${errorData.message || "未知错误"}`);
        }
        const githubData = await githubResponse.json();
    },
    errorResponse: function (message, status = 500) {
        return new Response(
            JSON.stringify({
                success: false,
                message: message,
            }),
            {
                status: status,
                headers: { "Content-Type": "application/json" },
            },
        )
    },
    fetchAndCache: async function (request, time) {
        var response = await caches.default.match(request);
        if (response) {
            console.log("Cache hit:", request.url);
            return response;
        }
        console.log("Cache miss:", request.url);
        response = await fetch(request);
        await caches.default.put(request, response.clone(), {
            expirationTtl: time,
        });
        return response;
    }
}