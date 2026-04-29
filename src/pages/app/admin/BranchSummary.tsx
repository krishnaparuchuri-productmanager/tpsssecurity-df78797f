import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/format";

interface Row { branch_id: string; branch_name: string; branch_code: string; is_head_office: boolean; client_count: number; employee_count: number; active_deployment_count: number; month_billing: number; month_outstanding: number; }

export default function BranchSummary() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.rpc("get_branch_summary").then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Branch Summary</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Per-branch snapshot</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Branch</TableHead><TableHead className="text-right">Clients</TableHead>
              <TableHead className="text-right">Employees</TableHead><TableHead className="text-right">Active Deployments</TableHead>
              <TableHead className="text-right">Month Billing</TableHead><TableHead className="text-right">Outstanding</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-app-muted">No branches</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.branch_id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link to={`/app/dashboard/v3c?branch=${r.branch_id}`} className="font-medium text-app-navy hover:underline">
                      {r.branch_name} <span className="font-mono text-xs text-app-muted">[{r.branch_code}]</span>
                    </Link>
                    {r.is_head_office && <Badge className="ml-2 bg-app-saffron/20 text-app-navy">HO</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.client_count)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.employee_count)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.active_deployment_count)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.month_billing))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.month_outstanding))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
