export async function onRequestGet(context) {
    const cookieHeader = context.request.headers.get('Cookie') || '';
    const match = cookieHeader.match(/user_session=([^;]+)/);
    if (!match) return Response.json(null);

    try {
        const user = JSON.parse(decodeURIComponent(atob(match[1])));
        return Response.json(user);
    } catch {
        return Response.json(null);
    }
}