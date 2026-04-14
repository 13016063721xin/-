import { createClient } from '@supabase/supabase-js'

// 🚀 这里已经填入你截图中的专属信息
const supabaseUrl = 'https://veahztrlpxkxzugzkmnx.supabase.co'
const supabaseKey = 'sb_publishable_LefgP5QLodGreXhnufR9RA_8GvJGQWX'

const supabase = createClient(supabaseUrl, supabaseKey)

const statusEl = document.getElementById('statusMessage');

// 注册逻辑
document.getElementById('signUpBtn').onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        statusEl.innerText = "⚠️ 请填写邮箱和密码";
        return;
    }

    statusEl.innerText = "📡 正在连接云端服务器...";
    statusEl.style.color = "#fbbf24";

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        statusEl.innerText = "❌ 注册失败: " + error.message;
        statusEl.style.color = "#f87171";
    } else {
        statusEl.innerText = "✅ 注册成功！请去 Supabase 后台 Users 刷新查看。";
        statusEl.style.color = "#34d399";
    }
};

// 登录逻辑
document.getElementById('signInBtn').onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    statusEl.innerText = "🔑 正在核对身份...";
    statusEl.style.color = "#fbbf24";

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        statusEl.innerText = "❌ 登录失败: " + error.message;
        statusEl.style.color = "#f87171";
    } else {
        statusEl.innerText = "🎉 登录成功！欢迎回来！";
        statusEl.style.color = "#34d399";
        console.log("登录成功，用户数据:", data.user);
    }
};