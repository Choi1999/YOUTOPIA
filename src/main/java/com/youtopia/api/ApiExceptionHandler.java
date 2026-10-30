package com.youtopia.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import com.youtopia.steam.service.CcuRequestBudget.BudgetExceededException;
import com.youtopia.steam.service.CcuRequestBudget.BudgetUnavailableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(com.youtopia.account.AccountProblem.class)
    ResponseEntity<ProblemDetail> account(com.youtopia.account.AccountProblem error, HttpServletRequest request) {
        var builder=ResponseEntity.status(error.status);
        if(error.retryAfter!=null)builder.header("Retry-After",error.retryAfter.toString());
        return builder.body(ApiProblems.create(error.status,error.code,error.getMessage(),request));
    }
    @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
    ProblemDetail invalidBody(org.springframework.web.bind.MethodArgumentNotValidException error,HttpServletRequest request) {
        var result=ApiProblems.create(HttpStatus.BAD_REQUEST,"INVALID_REQUEST","Request fields are invalid.",request);
        var fields=new java.util.TreeMap<String,String>();
        error.getBindingResult().getFieldErrors().forEach(e->fields.put(e.getField(),"Invalid value"));
        result.setProperty("fieldErrors",fields);return result;
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ProblemDetail notFound(HttpServletRequest request) {
        return ApiProblems.create(HttpStatus.NOT_FOUND, "NOT_FOUND", "The resource was not found.", request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ProblemDetail methodNotAllowed(HttpServletRequest request) {
        return ApiProblems.create(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED",
            "The request method is not supported.", request);
    }

    @ExceptionHandler(BudgetExceededException.class)
    ResponseEntity<ProblemDetail> rateLimit(BudgetExceededException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .header("Retry-After", Long.toString(exception.retryAfter()))
            .body(ApiProblems.create(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                "The query budget is temporarily exhausted.", request));
    }

    @ExceptionHandler(BudgetUnavailableException.class)
    ProblemDetail budgetUnavailable(HttpServletRequest request) {
        return ApiProblems.create(HttpStatus.SERVICE_UNAVAILABLE, "REQUEST_BUDGET_UNAVAILABLE",
            "The query budget could not be verified.", request);
    }

    @ExceptionHandler({IllegalArgumentException.class, HandlerMethodValidationException.class,
        MethodArgumentTypeMismatchException.class, HttpMessageNotReadableException.class})
    ProblemDetail invalid(Exception exception, HttpServletRequest request) {
        if(Boolean.TRUE.equals(request.getAttribute(RequestBodyLimitFilter.TOO_LARGE)))return ApiProblems.create(HttpStatus.PAYLOAD_TOO_LARGE,"REQUEST_TOO_LARGE","The request body is too large.",request);
        return ApiProblems.create(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Request parameters are invalid.", request);
    }

    @ExceptionHandler(DataAccessException.class)
    ProblemDetail dataUnavailable(HttpServletRequest request) {
        return ApiProblems.create(HttpStatus.SERVICE_UNAVAILABLE, "DATA_SOURCE_ERROR",
            "The data source could not be queried.", request);
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(HttpServletRequest request) {
        return ApiProblems.create(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
            "The request could not be completed.", request);
    }
}
