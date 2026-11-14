import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "./markdown";

export function MemoBody({ body }: { body: string }) {
  return (
    <div className="memo-body">
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {body}
      </Markdown>
    </div>
  );
}
