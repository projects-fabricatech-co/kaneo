CREATE TABLE "admin_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" text NOT NULL,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"store_id" text,
	"reason" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"granted_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_failures" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text,
	"event_type" text,
	"reason" text NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "admin_audit_log_createdAt_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_adminUserId_idx" ON "admin_audit_log" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_storeId_idx" ON "admin_audit_log" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "platform_admins_grantedByUserId_idx" ON "platform_admins" USING btree ("granted_by_user_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_failures_createdAt_idx" ON "stripe_webhook_failures" USING btree ("created_at");--> statement-breakpoint
CREATE FUNCTION "admin_audit_log_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'admin_audit_log is append-only: % is not allowed', TG_OP;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "admin_audit_log_no_update" BEFORE UPDATE ON "admin_audit_log" FOR EACH STATEMENT EXECUTE FUNCTION "admin_audit_log_append_only"();--> statement-breakpoint
CREATE TRIGGER "admin_audit_log_no_delete" BEFORE DELETE ON "admin_audit_log" FOR EACH STATEMENT EXECUTE FUNCTION "admin_audit_log_append_only"();