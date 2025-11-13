import sys

# Tiny mock model to generate a simple answer
if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:])
    answer = (
        "Based on CRM records, here’s what I found:\n"
        "- Billing is delayed for customer A.\n"
        "- Refund has not been processed yet.\n"
        "The support team is advised to take immediate action."
    )
    print(answer)
