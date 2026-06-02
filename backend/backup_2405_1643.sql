--
-- PostgreSQL database dump
--

\restrict Af9pugAObQaQhV5f1WKi0YhZ5mpDwr12TjH8b4tvGaXnE1mHdmZmnuepu8knlsc

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100),
    full_name character varying(220) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(150),
    address text,
    city character varying(100),
    state character varying(100),
    pincode character varying(20),
    gst_number character varying(50),
    total_orders integer DEFAULT 0 NOT NULL,
    total_spent numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_items (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    invoice_id integer NOT NULL,
    product_id integer,
    product_code character varying(100) NOT NULL,
    product_name_snapshot character varying(255) NOT NULL,
    category_snapshot character varying(150),
    unit_snapshot character varying(50),
    mrp numeric(12,2) DEFAULT 0 NOT NULL,
    buy_price numeric(12,2) DEFAULT 0 NOT NULL,
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    discount_amount_per_unit numeric(12,2) DEFAULT 0 NOT NULL,
    total_discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    selling_price_per_unit numeric(12,2) DEFAULT 0 NOT NULL,
    total_selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    total_buy_cost numeric(12,2) DEFAULT 0 NOT NULL,
    profit_per_unit numeric(12,2) DEFAULT 0 NOT NULL,
    total_profit numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_invoice_items_discount_percentage CHECK (((discount_percentage >= (0)::numeric) AND (discount_percentage <= (100)::numeric))),
    CONSTRAINT chk_invoice_items_quantity CHECK ((quantity > (0)::numeric))
);


ALTER TABLE public.invoice_items OWNER TO postgres;

--
-- Name: invoice_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invoice_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_items_id_seq OWNER TO postgres;

--
-- Name: invoice_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invoice_items_id_seq OWNED BY public.invoice_items.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    invoice_number character varying(50) NOT NULL,
    customer_id integer,
    customer_name_snapshot character varying(220) NOT NULL,
    customer_phone_snapshot character varying(20) NOT NULL,
    customer_email_snapshot character varying(150),
    customer_address_snapshot text,
    customer_city_snapshot character varying(100),
    customer_state_snapshot character varying(100),
    customer_pincode_snapshot character varying(20),
    customer_gst_number_snapshot character varying(50),
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    subtotal_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    final_amount numeric(12,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    remaining_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_buy_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_profit numeric(12,2) DEFAULT 0 NOT NULL,
    payment_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    payment_mode character varying(30),
    invoice_status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_invoices_invoice_status CHECK (((invoice_status)::text = ANY ((ARRAY['draft'::character varying, 'saved'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_invoices_payment_mode CHECK (((payment_mode IS NULL) OR ((payment_mode)::text = ANY ((ARRAY['cash'::character varying, 'upi'::character varying, 'card'::character varying, 'bank_transfer'::character varying, 'other'::character varying])::text[])))),
    CONSTRAINT chk_invoices_payment_status CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'partial'::character varying])::text[])))
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoices_id_seq OWNER TO postgres;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id integer NOT NULL,
    image_url character varying(255) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_main boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.product_images OWNER TO postgres;

--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_images_id_seq OWNER TO postgres;

--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: product_sales_analytics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_sales_analytics (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    invoice_id integer NOT NULL,
    invoice_number character varying(50) NOT NULL,
    invoice_date date NOT NULL,
    customer_id integer,
    customer_name character varying(220),
    customer_phone character varying(20),
    product_id integer,
    product_code character varying(100) NOT NULL,
    product_name character varying(255) NOT NULL,
    category character varying(150),
    buy_price numeric(12,2) DEFAULT 0 NOT NULL,
    mrp numeric(12,2) DEFAULT 0 NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    selling_price_per_unit numeric(12,2) DEFAULT 0 NOT NULL,
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    total_selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    total_buy_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_profit numeric(12,2) DEFAULT 0 NOT NULL,
    payment_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_product_sales_payment_status CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'partial'::character varying])::text[])))
);


ALTER TABLE public.product_sales_analytics OWNER TO postgres;

--
-- Name: product_sales_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_sales_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_sales_analytics_id_seq OWNER TO postgres;

--
-- Name: product_sales_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_sales_analytics_id_seq OWNED BY public.product_sales_analytics.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    name character varying(200) NOT NULL,
    sku character varying(100) NOT NULL,
    category character varying(100) NOT NULL,
    description text,
    buying_price numeric(12,2) DEFAULT 0 NOT NULL,
    mrp numeric(12,2) DEFAULT 0 NOT NULL,
    selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    low_stock_threshold integer DEFAULT 5 NOT NULL,
    unit character varying(50) DEFAULT 'pcs'::character varying NOT NULL,
    barcode character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    main_image_url character varying(255),
    total_units_sold integer DEFAULT 0 NOT NULL,
    total_sales_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_profit_amount numeric(14,2) DEFAULT 0 NOT NULL,
    last_sold_at timestamp without time zone,
    last_restocked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: shops; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shops (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    category character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(20) NOT NULL,
    address text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    logo_url character varying(255),
    whatsapp_number character varying(20),
    shop_address text
);


ALTER TABLE public.shops OWNER TO postgres;

--
-- Name: shops_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shops_id_seq OWNER TO postgres;

--
-- Name: shops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shops_id_seq OWNED BY public.shops.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    full_name character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash text NOT NULL,
    role character varying(50) DEFAULT 'owner'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    phone character varying(20),
    profile_image_url character varying(255),
    first_name character varying(100),
    last_name character varying(100),
    timezone character varying(100),
    language character varying(50) DEFAULT 'English (US)'::character varying,
    two_factor_enabled boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vendor_bill_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_bill_payments (
    id bigint NOT NULL,
    shop_id bigint NOT NULL,
    vendor_bill_id bigint NOT NULL,
    payment_date date NOT NULL,
    amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    payment_mode character varying(50),
    reference_number character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.vendor_bill_payments OWNER TO postgres;

--
-- Name: vendor_bill_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vendor_bill_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendor_bill_payments_id_seq OWNER TO postgres;

--
-- Name: vendor_bill_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vendor_bill_payments_id_seq OWNED BY public.vendor_bill_payments.id;


--
-- Name: vendor_bills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_bills (
    id bigint NOT NULL,
    shop_id bigint NOT NULL,
    vendor_id bigint NOT NULL,
    bill_number character varying(100) NOT NULL,
    bill_date date NOT NULL,
    due_date date,
    total_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    remaining_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    payment_mode character varying(50),
    payment_reference character varying(100),
    reminder_days_before integer DEFAULT 7 NOT NULL,
    attachment_url character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT vendor_bills_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'partial'::character varying, 'completed'::character varying, 'overdue'::character varying])::text[])))
);


ALTER TABLE public.vendor_bills OWNER TO postgres;

--
-- Name: vendor_bills_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vendor_bills_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendor_bills_id_seq OWNER TO postgres;

--
-- Name: vendor_bills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vendor_bills_id_seq OWNED BY public.vendor_bills.id;


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendors (
    id bigint NOT NULL,
    shop_id bigint NOT NULL,
    vendor_name character varying(150) NOT NULL,
    company_name character varying(150),
    email character varying(150),
    phone character varying(20),
    alternate_phone character varying(20),
    tax_number character varying(100),
    address_line_1 character varying(255),
    address_line_2 character varying(255),
    city character varying(100),
    state character varying(100),
    postal_code character varying(20),
    country character varying(100),
    payment_terms character varying(100),
    default_reminder_days integer DEFAULT 7 NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.vendors OWNER TO postgres;

--
-- Name: vendors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vendors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendors_id_seq OWNER TO postgres;

--
-- Name: vendors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vendors_id_seq OWNED BY public.vendors.id;


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: invoice_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items ALTER COLUMN id SET DEFAULT nextval('public.invoice_items_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: product_sales_analytics id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_sales_analytics ALTER COLUMN id SET DEFAULT nextval('public.product_sales_analytics_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: shops id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops ALTER COLUMN id SET DEFAULT nextval('public.shops_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vendor_bill_payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_bill_payments ALTER COLUMN id SET DEFAULT nextval('public.vendor_bill_payments_id_seq'::regclass);


--
-- Name: vendor_bills id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_bills ALTER COLUMN id SET DEFAULT nextval('public.vendor_bills_id_seq'::regclass);


--
-- Name: vendors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors ALTER COLUMN id SET DEFAULT nextval('public.vendors_id_seq'::regclass);


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, shop_id, first_name, last_name, full_name, phone, email, address, city, state, pincode, gst_number, total_orders, total_spent, created_at, updated_at) FROM stdin;
1	4	yash	patel	yash patel	9999999999	c@gmail.com	mavdi	rajkot	gujarat	380015	\N	1	944.13	2026-05-12 23:18:54.356817	2026-05-12 23:18:54.356817
2	4	ravi	patel	ravi patel	8238813001	r@gmail.com	mavdi	rajkot	gujarat	380015	\N	1	2700.00	2026-05-12 23:50:21.653162	2026-05-12 23:50:21.653162
3	4	Dishant	tilara	Dishant tilara	8469318735	d@gmail.com	nana mava	rajkot	gujarat	188888	\N	1	1350.00	2026-05-13 12:23:26.914492	2026-05-13 12:23:26.914492
5	7	Aditya	Gohel	Aditya Gohel	8799040211	aditya@gmail.com	Kothariya Road	Rajkot	Gujarat	380015	\N	2	11571.00	2026-05-19 16:33:48.949058	2026-05-19 16:37:17.760804
4	7	Yash	patel	Yash patel	1212121212	yash@gmail.com	junagadh	junagadh	gujarat	380015	\N	2	3192.00	2026-05-15 12:32:09.101352	2026-05-19 22:40:48.155876
\.


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_items (id, shop_id, invoice_id, product_id, product_code, product_name_snapshot, category_snapshot, unit_snapshot, mrp, buy_price, quantity, discount_percentage, discount_amount_per_unit, total_discount_amount, selling_price_per_unit, total_selling_price, total_buy_cost, profit_per_unit, total_profit, created_at, updated_at) FROM stdin;
1	4	1	6	1234	test12	Home Decor	pcs	300.00	120.00	2.00	15.00	45.00	90.00	255.00	510.00	240.00	135.00	270.00	2026-05-12 23:18:54.356817	2026-05-12 23:18:54.356817
2	4	1	1	12	hey	Apparel	pcs	499.00	199.00	1.00	13.00	64.87	64.87	434.13	434.13	199.00	235.13	235.13	2026-05-12 23:18:54.356817	2026-05-12 23:18:54.356817
3	4	2	6	1234	test12	Home Decor	pcs	300.00	120.00	10.00	10.00	30.00	300.00	270.00	2700.00	1200.00	150.00	1500.00	2026-05-12 23:50:21.653162	2026-05-12 23:50:21.653162
4	4	3	6	1234	test12	Home Decor	pcs	300.00	120.00	5.00	10.00	30.00	150.00	270.00	1350.00	600.00	150.00	750.00	2026-05-13 12:23:26.914492	2026-05-13 12:23:26.914492
5	7	4	7	c1	candle	Home Decor	pcs	399.00	120.00	10.00	20.00	79.80	798.00	319.20	3192.00	1200.00	199.20	1992.00	2026-05-15 12:32:09.101352	2026-05-15 12:32:09.101352
6	7	5	7	c1	candle	Home Decor	pcs	399.00	120.00	10.00	10.00	39.90	399.00	359.10	3591.00	1200.00	239.10	2391.00	2026-05-19 16:33:48.949058	2026-05-19 16:33:48.949058
7	7	6	7	c1	candle	Home Decor	pcs	399.00	120.00	25.00	20.00	79.80	1995.00	319.20	7980.00	3000.00	199.20	4980.00	2026-05-19 16:37:17.760804	2026-05-19 16:37:17.760804
8	7	7	7	c1	candle	Home Decor	pcs	399.00	120.00	5.00	100.00	399.00	1995.00	0.00	0.00	600.00	-120.00	-600.00	2026-05-19 22:40:48.155876	2026-05-19 22:40:48.155876
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, shop_id, invoice_number, customer_id, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, customer_address_snapshot, customer_city_snapshot, customer_state_snapshot, customer_pincode_snapshot, customer_gst_number_snapshot, invoice_date, subtotal_amount, total_discount_amount, total_tax_amount, final_amount, paid_amount, remaining_amount, total_buy_cost, total_profit, payment_status, payment_mode, invoice_status, notes, created_by, created_at, updated_at) FROM stdin;
1	4	INV-20260512-001	1	yash patel	9999999999	c@gmail.com	mavdi	rajkot	gujarat	380015	\N	2026-05-12	1099.00	154.87	0.00	944.13	944.13	0.00	439.00	505.13	paid	cash	saved		3	2026-05-12 23:18:54.356817	2026-05-12 23:18:54.356817
2	4	INV-20260512-002	2	ravi patel	8238813001	r@gmail.com	mavdi	rajkot	gujarat	380015	\N	2026-05-12	3000.00	300.00	0.00	2700.00	0.00	2700.00	1200.00	1500.00	pending	\N	saved		3	2026-05-12 23:50:21.653162	2026-05-12 23:50:21.653162
3	4	INV-20260513-001	3	Dishant tilara	8469318735	d@gmail.com	nana mava	rajkot	gujarat	188888	\N	2026-05-13	1500.00	150.00	0.00	1350.00	1350.00	0.00	600.00	750.00	paid	cash	saved		3	2026-05-13 12:23:26.914492	2026-05-13 12:23:26.914492
4	7	INV-20260515-001	4	Yash patel	1212121212	yash@gmail.com	junagadh	junagadh	gujarat	380015	\N	2026-05-15	3990.00	798.00	0.00	3192.00	3192.00	0.00	1200.00	1992.00	paid	cash	saved		6	2026-05-15 12:32:09.101352	2026-05-15 12:32:09.101352
5	7	INV-20260519-001	5	Aditya Gohel	8799040211	aditya@gmail.com	Kothariya Road	Rajkot	Gujarat	380015	\N	2026-05-19	3990.00	399.00	0.00	3591.00	0.00	3591.00	1200.00	2391.00	pending	\N	saved		6	2026-05-19 16:33:48.949058	2026-05-19 16:33:48.949058
6	7	INV-20260519-002	5	Aditya Gohel	8799040211	aditya@gmail.com	Kothariya Road	Rajkot	Gujarat	380015	\N	2026-05-19	9975.00	1995.00	0.00	7980.00	7980.00	0.00	3000.00	4980.00	pending	cash	saved		6	2026-05-19 16:37:17.760804	2026-05-19 16:37:17.760804
7	7	INV-20260519-003	4	Yash patel	1212121212	yash@gmail.com	junagadh	junagadh	gujarat	380015	\N	2026-05-19	1995.00	1995.00	0.00	0.00	0.00	0.00	600.00	-600.00	pending	\N	saved		6	2026-05-19 22:40:48.155876	2026-05-19 22:40:48.155876
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_images (id, product_id, image_url, sort_order, is_main, created_at) FROM stdin;
1	5	/uploads/products/68448a56b72b4535af382446a5bfcaf8.png	0	t	2026-05-01 23:38:10.105454
3	5	/uploads/products/820c7dda4797434a9ab8581989906b27.jpg	1	f	2026-05-02 00:13:53.509261
4	6	/uploads/products/dba32e418e144c93858643d52dfa346f.jpg	0	t	2026-05-02 22:23:29.045866
5	7	/uploads/products/e1937c32094144de926ba98fdae961b4.jpg	0	t	2026-05-14 19:15:20.88037
\.


--
-- Data for Name: product_sales_analytics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_sales_analytics (id, shop_id, invoice_id, invoice_number, invoice_date, customer_id, customer_name, customer_phone, product_id, product_code, product_name, category, buy_price, mrp, discount_percentage, discount_amount, selling_price_per_unit, quantity, total_selling_price, total_buy_cost, total_profit, payment_status, created_at) FROM stdin;
1	4	1	INV-20260512-001	2026-05-12	1	yash patel	9999999999	6	1234	test12	Home Decor	120.00	300.00	15.00	90.00	255.00	2.00	510.00	240.00	270.00	paid	2026-05-12 23:18:54.356817
2	4	1	INV-20260512-001	2026-05-12	1	yash patel	9999999999	1	12	hey	Apparel	199.00	499.00	13.00	64.87	434.13	1.00	434.13	199.00	235.13	paid	2026-05-12 23:18:54.356817
3	4	2	INV-20260512-002	2026-05-12	2	ravi patel	8238813001	6	1234	test12	Home Decor	120.00	300.00	10.00	300.00	270.00	10.00	2700.00	1200.00	1500.00	pending	2026-05-12 23:50:21.653162
4	4	3	INV-20260513-001	2026-05-13	3	Dishant tilara	8469318735	6	1234	test12	Home Decor	120.00	300.00	10.00	150.00	270.00	5.00	1350.00	600.00	750.00	paid	2026-05-13 12:23:26.914492
5	7	4	INV-20260515-001	2026-05-15	4	Yash patel	1212121212	7	c1	candle	Home Decor	120.00	399.00	20.00	798.00	319.20	10.00	3192.00	1200.00	1992.00	paid	2026-05-15 12:32:09.101352
6	7	5	INV-20260519-001	2026-05-19	5	Aditya Gohel	8799040211	7	c1	candle	Home Decor	120.00	399.00	10.00	399.00	359.10	10.00	3591.00	1200.00	2391.00	pending	2026-05-19 16:33:48.949058
7	7	6	INV-20260519-002	2026-05-19	5	Aditya Gohel	8799040211	7	c1	candle	Home Decor	120.00	399.00	20.00	1995.00	319.20	25.00	7980.00	3000.00	4980.00	pending	2026-05-19 16:37:17.760804
8	7	7	INV-20260519-003	2026-05-19	4	Yash patel	1212121212	7	c1	candle	Home Decor	120.00	399.00	100.00	1995.00	0.00	5.00	0.00	600.00	-600.00	pending	2026-05-19 22:40:48.155876
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, shop_id, name, sku, category, description, buying_price, mrp, selling_price, stock_quantity, low_stock_threshold, unit, barcode, is_active, main_image_url, total_units_sold, total_sales_amount, total_profit_amount, last_sold_at, last_restocked_at, created_at, updated_at) FROM stdin;
2	4	calix-qa	fdsgfdgdf	Footwear	safsgsfdvgfgdvg	99.00	345.00	0.00	16	5	pcs	\N	t	dfg dfgvs	0	0.00	0.00	\N	\N	2026-04-30 11:32:34.973127	2026-04-30 11:32:34.973127
5	4	ariv_retriever	yash	Apparel	qwertyuio	100.00	275.00	222.00	20	10	pcs	\N	t	/uploads/products/68448a56b72b4535af382446a5bfcaf8.png	0	0.00	0.00	\N	\N	2026-05-01 23:38:10.029743	2026-05-01 23:38:10.029743
3	4	wwqe	qwewqe	Home Decor	wqe	121.00	125.00	0.00	0	5	pcs	\N	t	\N	0	0.00	0.00	\N	\N	2026-04-30 11:35:42.094627	2026-05-02 01:25:57.424023
1	4	hey	12	Apparel	hello hello	199.00	499.00	0.00	199	10	pcs	\N	t	\N	0	0.00	0.00	\N	\N	2026-04-30 01:57:44.370495	2026-05-12 23:18:54.356817
6	4	test12	1234	Home Decor	xtuyjcycutkcr	120.00	300.00	0.00	4	10	pcs	\N	t	/uploads/products/dba32e418e144c93858643d52dfa346f.jpg	0	0.00	0.00	\N	\N	2026-05-02 22:23:29.022441	2026-05-13 12:23:26.914492
7	7	candle	c1	Home Decor	parafin wax candles	120.00	399.00	0.00	0	10	pcs	\N	t	/uploads/products/e1937c32094144de926ba98fdae961b4.jpg	0	0.00	0.00	\N	\N	2026-05-14 19:15:20.847508	2026-05-19 22:40:48.155876
8	7	calix-qa	12	Electronics	\N	0.49	0.08	0.06	3	30	pcs	\N	t	\N	0	0.00	0.00	\N	\N	2026-05-19 22:44:34.963887	2026-05-19 22:45:12.249542
\.


--
-- Data for Name: shops; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shops (id, name, category, email, phone, address, created_at, updated_at, logo_url, whatsapp_number, shop_address) FROM stdin;
4	Pahenava	Fashion	lisit@pehnava.com	9664899195	\N	2026-04-28 16:33:40.585469	2026-04-28 16:33:40.585469	/uploads/logos/331bda4ac3064028a1464f80835c4290.jpg	\N	\N
5	Angan Crafts	Bakery	Yash@gmail.com	9664899195	\N	2026-05-02 02:01:49.533158	2026-05-02 02:01:49.533158	/uploads/logos/ec7bab22ad4847389c6b4843b2a8eeb3.png	\N	\N
6	Hello Store	General Store	yashsavaliya159@gmail.com	7624083560	\N	2026-05-06 13:30:28.674072	2026-05-06 13:30:28.674072	/uploads/logos/2a8dc04fb4c047f9be1ad4e731ace3a6.jpg	\N	\N
7	Angan Crafts	Fashion	angan@gmail.com	7624083560	Akshar Township, Keshod	2026-05-14 19:12:58.666462	2026-05-14 19:12:58.666462	/uploads/logos/ce4a0c63da064b08abfc9d03a721fac3.png	9664899195	\N
8	Shree	General Store	s@gmail.com	1234567890	Mota Gundala	2026-05-20 13:23:10.190982	2026-05-20 13:23:10.190982	/uploads/logos/bdfa1cc9185c476aad3cf97102460cc9.jpg	1234567890	\N
9	codegrin	Electronics	chintan@gmail.com	9898989898	rajkot	2026-05-24 04:40:39.818569	2026-05-24 04:40:39.818569	/uploads/logos/ca6dd9b38f084d049c3f2021dac61e91.png	7777777777	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, shop_id, full_name, email, password_hash, role, is_active, created_at, updated_at, phone, profile_image_url, first_name, last_name, timezone, language, two_factor_enabled) FROM stdin;
4	5	Yash Patel	Yash@gmail.com	$2b$12$.eINpiI2i.yvkbpLduZ9puErwi1uunZ9l7QEA55LnIPl/Zuf935Q6	owner	t	2026-05-02 02:01:49.533158	2026-05-02 02:01:49.533158	\N	\N	\N	\N	\N	English (US)	f
5	6	Yash Patel	yashsavaliya159@gmail.com	$2b$12$wshflfEjbuXIhC4cbQwoK.RNpQ2wCG4AjpA5kugyAzDniokDnarzO	owner	t	2026-05-06 13:30:28.674072	2026-05-06 13:30:28.674072	\N	\N	\N	\N	\N	English (US)	f
3	4	Lisit Ribadiya	lisit@pehnava.com	$2b$12$tRxl04iJjYycUHIHsJsFk.156pPmVyzOWfww1f9F/Wj1zsILWmsAy	owner	t	2026-04-28 16:33:40.585469	2026-05-09 10:36:25.852491	9664899195	\N	Lisit	Ribadiya	(GMT+05:30) India Standard Time	English (US)	f
6	7	Yash Patel	angan@gmail.com	$2b$12$OXH65illPmurErB1lT3ZU.aaAArJyHTcKjWldoSjd7DTVPnBEMvGa	owner	t	2026-05-14 19:12:58.666462	2026-05-14 19:12:58.666462	7624083560	\N	Yash	Patel	\N	English (US)	f
7	8	Viren	s@gmail.com	$2b$12$LgfXyXoGd.ZG9zrjlgOuP.y4ucW2/TlC6C1HJO55xElUlDDZg1CUq	owner	t	2026-05-20 13:23:10.190982	2026-05-20 13:23:10.190982	1234567890	\N	Viren	\N	\N	English (US)	f
8	9	chintan	chintan@gmail.com	$2b$12$1z6OF9u3tp7VsnG1jzI4BuLGhfKloiTQo8Jq4kUtQwyfhglpJxJT6	owner	t	2026-05-24 04:40:39.818569	2026-05-24 04:40:39.818569	9898989898	\N	chintan	\N	\N	English (US)	f
\.


--
-- Data for Name: vendor_bill_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_bill_payments (id, shop_id, vendor_bill_id, payment_date, amount, payment_mode, reference_number, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vendor_bills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_bills (id, shop_id, vendor_id, bill_number, bill_date, due_date, total_amount, paid_amount, remaining_amount, status, payment_mode, payment_reference, reminder_days_before, attachment_url, notes, created_at, updated_at) FROM stdin;
1	4	1	1234	2026-05-08	2026-05-12	100000.00	20000.00	80000.00	partial	Cash	NA	7	\N	\N	2026-05-08 11:58:35.731741	2026-05-08 11:58:35.731741
2	4	1	345	2026-05-08	2026-05-13	140000.00	200000.00	0.00	completed	\N	\N	5	\N	\N	2026-05-08 12:13:54.373545	2026-05-08 12:13:54.373545
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendors (id, shop_id, vendor_name, company_name, email, phone, alternate_phone, tax_number, address_line_1, address_line_2, city, state, postal_code, country, payment_terms, default_reminder_days, notes, is_active, created_at, updated_at) FROM stdin;
1	4	hello	Ajmera Fashions	ajay@ajmera.com	123456789	954321987	123rdsfsdfsdf	yogi chok	varachha	surat	gujarat	380015	India	Net 15	7	\N	t	2026-05-08 11:57:26.50387	2026-05-08 11:57:26.50387
2	4	1	11223423	y@gmail.com	23432423432	4324324	212121	dgsfgfdg	fgdfgdfg	dfgdfgdfg	dfgdfgd	fgdfgdg	India	Net 15	7	fgdfgfd	f	2026-05-08 12:53:12.014032	2026-05-08 12:53:12.014032
3	4	ADSD	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	Net 15	7	\N	t	2026-05-11 16:55:52.441189	2026-05-11 16:55:52.441189
4	7	global suppliers	Nivanta Home Decor	care@nivanta.com	9898989898	7676767676	\N	Aaji GIDC	Gate 3, Plot 15	Rajkot	Gujarat	380015	India	Net 15	7	\N	t	2026-05-14 19:17:05.787739	2026-05-14 19:17:05.787739
\.


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 5, true);


--
-- Name: invoice_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invoice_items_id_seq', 8, true);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invoices_id_seq', 7, true);


--
-- Name: product_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_images_id_seq', 5, true);


--
-- Name: product_sales_analytics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_sales_analytics_id_seq', 8, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 8, true);


--
-- Name: shops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shops_id_seq', 9, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 8, true);


--
-- Name: vendor_bill_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendor_bill_payments_id_seq', 1, false);


--
-- Name: vendor_bills_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendor_bills_id_seq', 2, true);


--
-- Name: vendors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendors_id_seq', 4, true);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_sales_analytics product_sales_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_sales_analytics
    ADD CONSTRAINT product_sales_analytics_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (id);


--
-- Name: customers uq_customers_shop_phone; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT uq_customers_shop_phone UNIQUE (shop_id, phone);


--
-- Name: invoices uq_invoices_shop_invoice_number; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT uq_invoices_shop_invoice_number UNIQUE (shop_id, invoice_number);


--
-- Name: vendor_bills uq_vendor_bills_vendor_bill_number; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT uq_vendor_bills_vendor_bill_number UNIQUE (vendor_id, bill_number);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_bill_payments vendor_bill_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_bill_payments
    ADD CONSTRAINT vendor_bill_payments_pkey PRIMARY KEY (id);


--
-- Name: vendor_bills vendor_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT vendor_bills_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: idx_customers_full_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_full_name ON public.customers USING btree (full_name);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_customers_shop_full_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_shop_full_name ON public.customers USING btree (shop_id, full_name);


--
-- Name: idx_customers_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_shop_id ON public.customers USING btree (shop_id);


--
-- Name: idx_customers_shop_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_shop_phone ON public.customers USING btree (shop_id, phone);


--
-- Name: idx_customers_shop_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_shop_search ON public.customers USING btree (shop_id, full_name, phone);


--
-- Name: idx_invoice_items_invoice_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id);


--
-- Name: idx_invoice_items_product_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_items_product_code ON public.invoice_items USING btree (product_code);


--
-- Name: idx_invoice_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_items_product_id ON public.invoice_items USING btree (product_id);


--
-- Name: idx_invoice_items_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_items_shop_id ON public.invoice_items USING btree (shop_id);


--
-- Name: idx_invoice_items_shop_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_items_shop_product ON public.invoice_items USING btree (shop_id, product_id);


--
-- Name: idx_invoices_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_customer_id ON public.invoices USING btree (customer_id);


--
-- Name: idx_invoices_invoice_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_invoice_date ON public.invoices USING btree (invoice_date);


--
-- Name: idx_invoices_invoice_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_invoice_number ON public.invoices USING btree (invoice_number);


--
-- Name: idx_invoices_invoice_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_invoice_status ON public.invoices USING btree (invoice_status);


--
-- Name: idx_invoices_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_payment_status ON public.invoices USING btree (payment_status);


--
-- Name: idx_invoices_shop_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_shop_date ON public.invoices USING btree (shop_id, invoice_date);


--
-- Name: idx_invoices_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_shop_id ON public.invoices USING btree (shop_id);


--
-- Name: idx_invoices_shop_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_shop_payment_status ON public.invoices USING btree (shop_id, payment_status);


--
-- Name: idx_product_images_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_images_product_id ON public.product_images USING btree (product_id);


--
-- Name: idx_product_sales_analytics_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_analytics_customer_id ON public.product_sales_analytics USING btree (customer_id);


--
-- Name: idx_product_sales_analytics_invoice_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_analytics_invoice_date ON public.product_sales_analytics USING btree (invoice_date);


--
-- Name: idx_product_sales_analytics_shop_customer_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_analytics_shop_customer_date ON public.product_sales_analytics USING btree (shop_id, customer_id, invoice_date);


--
-- Name: idx_product_sales_analytics_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_analytics_shop_id ON public.product_sales_analytics USING btree (shop_id);


--
-- Name: idx_product_sales_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_category ON public.product_sales_analytics USING btree (category);


--
-- Name: idx_product_sales_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_customer_id ON public.product_sales_analytics USING btree (customer_id);


--
-- Name: idx_product_sales_invoice_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_invoice_date ON public.product_sales_analytics USING btree (invoice_date);


--
-- Name: idx_product_sales_invoice_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_invoice_id ON public.product_sales_analytics USING btree (invoice_id);


--
-- Name: idx_product_sales_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_product_id ON public.product_sales_analytics USING btree (product_id);


--
-- Name: idx_product_sales_shop_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_shop_date ON public.product_sales_analytics USING btree (shop_id, invoice_date);


--
-- Name: idx_product_sales_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_shop_id ON public.product_sales_analytics USING btree (shop_id);


--
-- Name: idx_product_sales_shop_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sales_shop_product ON public.product_sales_analytics USING btree (shop_id, product_id);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category ON public.products USING btree (category);


--
-- Name: idx_products_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_shop_id ON public.products USING btree (shop_id);


--
-- Name: idx_products_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_sku ON public.products USING btree (sku);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_shop_id ON public.users USING btree (shop_id);


--
-- Name: idx_vendor_bill_payments_bill_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_bill_payments_bill_id ON public.vendor_bill_payments USING btree (vendor_bill_id);


--
-- Name: idx_vendor_bill_payments_payment_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_bill_payments_payment_date ON public.vendor_bill_payments USING btree (payment_date);


--
-- Name: idx_vendor_bill_payments_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_bill_payments_shop_id ON public.vendor_bill_payments USING btree (shop_id);


--
-- Name: idx_vendor_bills_bill_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_bills_bill_date ON public.vendor_bills USING btree (bill_date);


--
-- Name: idx_vendor_bills_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_bills_due_date ON public.vendor_bills USING btree (due_date);


--
-- Name: idx_vendor_bills_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_bills_shop_id ON public.vendor_bills USING btree (shop_id);


--
-- Name: idx_vendor_bills_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_bills_status ON public.vendor_bills USING btree (status);


--
-- Name: idx_vendor_bills_vendor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_bills_vendor_id ON public.vendor_bills USING btree (vendor_id);


--
-- Name: idx_vendors_company_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendors_company_name ON public.vendors USING btree (company_name);


--
-- Name: idx_vendors_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendors_email ON public.vendors USING btree (email);


--
-- Name: idx_vendors_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendors_shop_id ON public.vendors USING btree (shop_id);


--
-- Name: idx_vendors_vendor_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendors_vendor_name ON public.vendors USING btree (vendor_name);


--
-- Name: customers trg_customers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: invoice_items trg_invoice_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_invoice_items_updated_at BEFORE UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: invoices trg_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: vendor_bill_payments trg_vendor_bill_payments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_vendor_bill_payments_updated_at BEFORE UPDATE ON public.vendor_bill_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: vendor_bills trg_vendor_bills_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_vendor_bills_updated_at BEFORE UPDATE ON public.vendor_bills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: vendors trg_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers customers_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: vendor_bill_payments fk_vendor_bill_payments_shop_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_bill_payments
    ADD CONSTRAINT fk_vendor_bill_payments_shop_id FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: vendor_bill_payments fk_vendor_bill_payments_vendor_bill_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_bill_payments
    ADD CONSTRAINT fk_vendor_bill_payments_vendor_bill_id FOREIGN KEY (vendor_bill_id) REFERENCES public.vendor_bills(id) ON DELETE CASCADE;


--
-- Name: vendor_bills fk_vendor_bills_shop_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT fk_vendor_bills_shop_id FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: vendor_bills fk_vendor_bills_vendor_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT fk_vendor_bills_vendor_id FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendors fk_vendors_shop_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT fk_vendors_shop_id FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_sales_analytics product_sales_analytics_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_sales_analytics
    ADD CONSTRAINT product_sales_analytics_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: product_sales_analytics product_sales_analytics_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_sales_analytics
    ADD CONSTRAINT product_sales_analytics_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: product_sales_analytics product_sales_analytics_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_sales_analytics
    ADD CONSTRAINT product_sales_analytics_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: product_sales_analytics product_sales_analytics_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_sales_analytics
    ADD CONSTRAINT product_sales_analytics_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: products products_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: users users_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Af9pugAObQaQhV5f1WKi0YhZ5mpDwr12TjH8b4tvGaXnE1mHdmZmnuepu8knlsc

