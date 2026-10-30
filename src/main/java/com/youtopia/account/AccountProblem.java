package com.youtopia.account;

import org.springframework.http.HttpStatus;

public final class AccountProblem extends RuntimeException {
    public final HttpStatus status;
    public final String code;
    public final Long retryAfter;
    public AccountProblem(HttpStatus status,String code,String detail) { this(status,code,detail,null); }
    public AccountProblem(HttpStatus status,String code,String detail,Long retryAfter) {super(detail);this.status=status;this.code=code;this.retryAfter=retryAfter;}
    public static AccountProblem invalid() { return new AccountProblem(HttpStatus.UNAUTHORIZED,"INVALID_CREDENTIALS","The credentials could not be verified."); }
    public static AccountProblem conflict(String code) { return new AccountProblem(HttpStatus.CONFLICT,code,"The request conflicts with the current state."); }
}
