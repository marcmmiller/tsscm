(log "hello world")

(define-macro (begin . body)
  (cons 'if (cons #f (cons #f body))))

(begin
  (log "hello")
  (log "world"))

(define (list . args) args)

(define (cond-expand clauses)
  (if (null? clauses) #f
    (if (eq? (car (car clauses)) 'else)
      (cons 'begin (cdr (car clauses)))
      (cons 'if (cons (car (car clauses))
        (cons (cons 'begin (cdr (car clauses)))
          (cons (cond-expand (cdr clauses)) '())))))))

(define-macro (cond . clauses)
  (cond-expand clauses))

(cond
  ((> 1 2) (log "nope"))
  ((< 1 2) (log "yes"))
  (else (log "fallback")))
