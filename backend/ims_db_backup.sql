--
-- PostgreSQL database dump
--

\restrict NiAv9enBlRT7qfgzLjvTJ1YyHSlOV24VL8Z9cLOk4nxjdZJLmFUItNF4hcUg4dy

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
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

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
    logo_url character varying(255)
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
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


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
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_images (id, product_id, image_url, sort_order, is_main, created_at) FROM stdin;
1	5	/uploads/products/68448a56b72b4535af382446a5bfcaf8.png	0	t	2026-05-01 23:38:10.105454
3	5	/uploads/products/820c7dda4797434a9ab8581989906b27.jpg	1	f	2026-05-02 00:13:53.509261
4	6	/uploads/products/dba32e418e144c93858643d52dfa346f.jpg	0	t	2026-05-02 22:23:29.045866
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, shop_id, name, sku, category, description, buying_price, mrp, selling_price, stock_quantity, low_stock_threshold, unit, barcode, is_active, main_image_url, total_units_sold, total_sales_amount, total_profit_amount, last_sold_at, last_restocked_at, created_at, updated_at) FROM stdin;
1	4	hey	12	Apparel	hello hello	199.00	499.00	0.00	200	10	pcs	\N	t	\N	0	0.00	0.00	\N	\N	2026-04-30 01:57:44.370495	2026-04-30 01:58:05.379861
2	4	calix-qa	fdsgfdgdf	Footwear	safsgsfdvgfgdvg	99.00	345.00	0.00	16	5	pcs	\N	t	dfg dfgvs	0	0.00	0.00	\N	\N	2026-04-30 11:32:34.973127	2026-04-30 11:32:34.973127
5	4	ariv_retriever	yash	Apparel	qwertyuio	100.00	275.00	222.00	20	10	pcs	\N	t	/uploads/products/68448a56b72b4535af382446a5bfcaf8.png	0	0.00	0.00	\N	\N	2026-05-01 23:38:10.029743	2026-05-01 23:38:10.029743
3	4	wwqe	qwewqe	Home Decor	wqe	121.00	125.00	0.00	0	5	pcs	\N	t	\N	0	0.00	0.00	\N	\N	2026-04-30 11:35:42.094627	2026-05-02 01:25:57.424023
6	4	test12	1234	Home Decor	xtuyjcycutkcr	120.00	300.00	0.00	70	10	pcs	\N	t	/uploads/products/dba32e418e144c93858643d52dfa346f.jpg	0	0.00	0.00	\N	\N	2026-05-02 22:23:29.022441	2026-05-02 22:23:29.022441
\.


--
-- Data for Name: shops; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shops (id, name, category, email, phone, address, created_at, updated_at, logo_url) FROM stdin;
4	Pahenava	Fashion	lisit@pehnava.com	9664899195	\N	2026-04-28 16:33:40.585469	2026-04-28 16:33:40.585469	/uploads/logos/331bda4ac3064028a1464f80835c4290.jpg
5	Angan Crafts	Bakery	Yash@gmail.com	9664899195	\N	2026-05-02 02:01:49.533158	2026-05-02 02:01:49.533158	/uploads/logos/ec7bab22ad4847389c6b4843b2a8eeb3.png
6	Hello Store	General Store	yashsavaliya159@gmail.com	7624083560	\N	2026-05-06 13:30:28.674072	2026-05-06 13:30:28.674072	/uploads/logos/2a8dc04fb4c047f9be1ad4e731ace3a6.jpg
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, shop_id, full_name, email, password_hash, role, is_active, created_at, updated_at, phone, profile_image_url, first_name, last_name, timezone, language, two_factor_enabled) FROM stdin;
4	5	Yash Patel	Yash@gmail.com	$2b$12$.eINpiI2i.yvkbpLduZ9puErwi1uunZ9l7QEA55LnIPl/Zuf935Q6	owner	t	2026-05-02 02:01:49.533158	2026-05-02 02:01:49.533158	\N	\N	\N	\N	\N	English (US)	f
5	6	Yash Patel	yashsavaliya159@gmail.com	$2b$12$wshflfEjbuXIhC4cbQwoK.RNpQ2wCG4AjpA5kugyAzDniokDnarzO	owner	t	2026-05-06 13:30:28.674072	2026-05-06 13:30:28.674072	\N	\N	\N	\N	\N	English (US)	f
3	4	Lisit Ribadiya	lisit@pehnava.com	$2b$12$tRxl04iJjYycUHIHsJsFk.156pPmVyzOWfww1f9F/Wj1zsILWmsAy	owner	t	2026-04-28 16:33:40.585469	2026-05-09 10:36:25.852491	9664899195	\N	Lisit	Ribadiya	(GMT+05:30) India Standard Time	English (US)	f
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
\.


--
-- Name: product_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_images_id_seq', 4, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 6, true);


--
-- Name: shops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shops_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


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

SELECT pg_catalog.setval('public.vendors_id_seq', 2, true);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


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
-- Name: idx_product_images_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_images_product_id ON public.product_images USING btree (product_id);


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
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


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

\unrestrict NiAv9enBlRT7qfgzLjvTJ1YyHSlOV24VL8Z9cLOk4nxjdZJLmFUItNF4hcUg4dy

