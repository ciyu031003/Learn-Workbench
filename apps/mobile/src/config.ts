import Constants from "expo-constants";

/** 后端地址：Android 模拟器通过 10.0.2.2 访问宿主机 localhost；真机请改为局域网 IP */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const API_URL = extra.apiUrl ?? "http://10.0.2.2:3000";
