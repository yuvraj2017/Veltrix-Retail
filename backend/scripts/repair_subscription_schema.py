def main() -> None:
    raise SystemExit(
        "Schema repair is now managed by Alembic. Run `alembic upgrade head` "
        "after verifying the target database and taking a backup."
    )


if __name__ == "__main__":
    main()
