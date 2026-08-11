import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleProcessReceiptOCR } from "../../functions/src/receiptOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleProcessReceiptOCR(req.body, createHandlerContext(context.uid, context.token));
});
