"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { caseInput, CATEGORIES, CURRENCIES, type CaseInput } from "@/lib/schemas";
import { api } from "@/lib/client-api";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useState } from "react";

type FormIn = z.input<typeof caseInput>;

export function CaseForm({ initial, caseId }: { initial?: Partial<CaseInput>; caseId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [serverError, setServerError] = useState<string>();
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<FormIn, unknown, CaseInput>({
    resolver: zodResolver(caseInput),
    defaultValues: { currency: "INR", category: "not_received", ...initial } as FormIn,
  });

  const onSubmit = async (data: CaseInput) => {
    setServerError(undefined);
    try {
      if (caseId) {
        // Send every field so clearing an optional value actually removes it.
        const full = Object.fromEntries(Object.keys(caseInput.shape).map((k) => [k, (data as Record<string, unknown>)[k] ?? ""]));
        await api(`/api/cases/${caseId}`, { method: "PATCH", json: full });
        toast("ok", "Case details saved");
        router.push(`/app/cases/${caseId}`);
        router.refresh();
      } else {
        const res = await api<{ case: { _id: string } }>("/api/cases", { method: "POST", json: data });
        toast("ok", "Case created");
        router.push(`/app/cases/${res.case._id}/evidence`);
      }
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  const err = (k: keyof FormIn) => errors[k]?.message as string | undefined;
  const inv = (k: keyof FormIn) => (errors[k] ? true : undefined);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-10">
      {serverError && <Alert tone="error" title="Could not save">{serverError}</Alert>}

      <fieldset className="grid gap-x-6 gap-y-5 sm:grid-cols-6">
        <legend className="label mb-4 w-full border-b border-rule pb-2 sm:col-span-6">The dispute</legend>
        <Field label="Case title" htmlFor="title" error={err("title")} hint="Something you'll recognise later, e.g. “Empty box — Meesho order, Sept”." className="sm:col-span-6">
          <Input id="title" aria-invalid={inv("title")} {...register("title")} autoFocus={!caseId} />
        </Field>
        <Field label="Dispute type" htmlFor="category" error={err("category")} className="sm:col-span-3">
          <Select id="category" {...register("category")}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Response deadline" htmlFor="deadline" optional error={err("deadline")} hint="The date the marketplace or courier needs your reply." className="sm:col-span-3">
          <Input id="deadline" type="date" aria-invalid={inv("deadline")} {...register("deadline")} />
        </Field>
        <Field label="What happened, in your words" htmlFor="description" optional error={err("description")} hint="Treated as your account of events — it is not used as evidence." className="sm:col-span-6">
          <Textarea id="description" rows={4} {...register("description")} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-x-6 gap-y-5 sm:grid-cols-6">
        <legend className="label mb-4 w-full border-b border-rule pb-2 sm:col-span-6">The order</legend>
        <Field label="Order reference" htmlFor="orderRef" optional error={err("orderRef")} className="sm:col-span-2">
          <Input id="orderRef" className="font-mono" {...register("orderRef")} />
        </Field>
        <Field label="Order value" htmlFor="orderValue" optional error={err("orderValue")} className="sm:col-span-2">
          <Input id="orderValue" inputMode="decimal" aria-invalid={inv("orderValue")} {...register("orderValue")} />
        </Field>
        <Field label="Currency" htmlFor="currency" className="sm:col-span-2">
          <Select id="currency" {...register("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
        </Field>
        <Field label="Sales channel" htmlFor="channel" optional hint="Marketplace or store, e.g. Amazon, Etsy, own website." className="sm:col-span-3">
          <Input id="channel" {...register("channel")} />
        </Field>
        <Field label="Customer reference" htmlFor="customerRef" optional hint="A pseudonym or order-system ID is enough. Avoid full names and addresses." className="sm:col-span-3">
          <Input id="customerRef" {...register("customerRef")} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-x-6 gap-y-5 sm:grid-cols-4">
        <legend className="label mb-4 w-full border-b border-rule pb-2 sm:col-span-4">Key dates <span className="normal-case tracking-normal">· all optional</span></legend>
        {([["orderDate", "Ordered"], ["dispatchDate", "Dispatched"], ["expectedDeliveryDate", "Expected delivery"], ["disputeDate", "Dispute opened"]] as const).map(([k, l]) => (
          <Field key={k} label={l} htmlFor={k} error={err(k)}>
            <Input id={k} type="date" aria-invalid={inv(k)} {...register(k)} />
          </Field>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-6">
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={!!caseId && !isDirty}>
          {caseId ? "Save changes" : "Create case and add evidence"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
