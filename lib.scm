;;
;; Minimal Scheme library that assumes a Scheme interpreter
;; with the following features:
;;
;; Special forms:
;;  lambda (with varargs support)
;;  and
;;  or
;;  define
;;  define-macro (most basic scheme macro support)
;;  quote
;;
;; Builtin functions:
;;  apply
;;  cons
;;  car
;;  cdr
;;  eq?
;;  null?
;;  pair?
;;
(define-macro (begin . body)
  (cons 'if (cons #f (cons #f body))))

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

(define not (lambda (x) (if x #f #t)))

(define map
  (lambda (func list1 . more-lists)
    (define some?
      (lambda (func list)
        ;; returns #f if (func x) returns #t for
        ;; some x in the list
        (and (pair? list)
             (or (func (car list))
                 (some? func (cdr list))))))
    (define map1
      (lambda (func list)
        ;; non-variadic map.  Returns a list whose elements
        ;; the result of calling func with corresponding
        ;; elements of list
        (if (null? list)
            '()
            (cons (func (car list))
                  (map1 func (cdr list))))))
    ;; Non-variadic map implementation terminates
    ;; when any of the argument lists is empty.
    ((lambda (lists)
       (if (some? null? lists)
           '()
           (cons (apply func (map1 car lists))
                 (apply map func (map1 cdr lists)))))
     (cons list1 more-lists))))

(define (length lst)
  (if (null? lst) 0
      (+ 1 (length (cdr lst)))))

(define (append l m)
  (if (null? l) m
      (cons (car l) (append (cdr l) m))))

(define cadr
  (lambda (p)
    (car (cdr p))))

;; Parallel-binding "let"
(define-macro (let forms . body)
    (cons (append (cons 'lambda (list (map car forms)))
                  body)
          (map cadr forms)))

;; Sequential-binding "let*"
(define-macro (let* forms . body)
  (if (null? forms)
      (cons 'begin body)
      `(let (,(car forms))
         (let* ,(cdr forms) ,@body))))

;; Recursive-binding "letrec"
(define-macro (letrec bindings . body)
  `(let ,(map (lambda (b) (list (car b) #f)) bindings)
     ,@(map (lambda (b) `(set! ,(car b) ,(cadr b))) bindings)
     ,@body))
