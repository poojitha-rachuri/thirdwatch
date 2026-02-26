from setuptools import setup, find_packages

setup(
    name="payments-service",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "stripe>=7.0",
        "boto3~=1.34",
        "requests>=2.31",
    ],
    extras_require={
        "dev": ["pytest>=7.0"],
    },
)
