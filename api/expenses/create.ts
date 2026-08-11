import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleCreateExpense } from "../../functions/src/expenseOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleCreateExpense(req.body, createHandlerContext(context.uid, context.token));
});
