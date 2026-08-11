export const accountService = {
  async deleteAccount(data: Record<string, never>): Promise<void> {
    const { fairtabApi } = await import("../api/fairtabApi");
    await fairtabApi.accounts.delete(data);
  },
};
