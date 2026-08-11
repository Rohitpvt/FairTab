import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleVoidExpense } from "../../functions/src/expenseOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleVoidExpense(req.body, createHandlerContext(context.uid, context.token));
});
