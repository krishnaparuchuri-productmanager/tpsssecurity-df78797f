import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExpenseForm from "./ExpenseForm";
import ExpensesList from "./ExpensesList";
import ExpensesSummary from "./ExpensesSummary";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

export default function ExpensesIndex() {
  const { can } = useAuth();
  const canCreate = can("expenses", "can_create");
  const [tab, setTab] = useState(canCreate ? "add" : "list");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Monthly Expenses</h1>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canCreate && <TabsTrigger value="add">Add Expense</TabsTrigger>}
          <TabsTrigger value="list">Expense List</TabsTrigger>
          <TabsTrigger value="summary">Monthly Summary</TabsTrigger>
        </TabsList>
        {canCreate && (
          <TabsContent value="add" className="pt-4">
            <ExpenseForm
              onSaved={() => {
                setRefreshKey((k) => k + 1);
                setTab("list");
              }}
            />
          </TabsContent>
        )}
        <TabsContent value="list" className="pt-4">
          <ExpensesList key={refreshKey} />
        </TabsContent>
        <TabsContent value="summary" className="pt-4">
          <ExpensesSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
