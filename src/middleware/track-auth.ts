export const isTrackerAuthenticated = async ({ jwtTrack, set, request }: any) => {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split(' ')[1];

  if (!token) {
    set.status = 401;
    return { error: "Missing tracking token" };
  }

  const payload = await jwtTrack.verify(token);

  if (!payload || payload.type !== 'TRACKING_TOKEN') {
    set.status = 401;
    return { error: "Invalid tracking token" };
  }
};