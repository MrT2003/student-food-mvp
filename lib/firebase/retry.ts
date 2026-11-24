// 1 lần đầu + tối đa 3 lần thử lại. Chờ bằng timer, không chặn render của React.
export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean = () => true,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await action(); }
    catch (error) {
      if (attempt >= 3 || !shouldRetry(error)) throw error;
      const jitter = 100 + Math.floor(Math.random() * 401);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000 * 2 ** attempt + jitter));
    }
  }
}
