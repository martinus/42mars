;redcode
;name DP-4
;author Ilmari Karonen
;strategy This program computes the n:th derivative of a polynomial.
;assert 1
; The coefficients of the input polynomial should be listed in
; ascending order (lowest-order term first) after the label "poly".
; Each coefficient should be given in the B-field of a DAT
; instruction.
;
; The constant "n" should be set to equal the number of times the
; polynomial is to be derived (at least 1 and less than the order of
; the polynomial).
;
; When the program has terminated, the coefficients of the output
; polynomial may be read from the location poly+n.
;
; NOTE: The program assumes there to be at least n instructions of
; empty core after the input.

n	equ	2	; how many times to derive?

order	equ	(pend-poly)

start	mov	#order	, <dv
dv	mul	@dv	, @poly+n
	djn	 dv	, @dv
	djn	 start	, #n

poly	; -- list coefficients in ascending order below --

;; example polynomial: 4*x^3 - 5*x^2 + 2*x + 55
;
	DAT	#55	; constant term
	DAT	#2	; x
	DAT	#-5	; x^2
	DAT	#4	; x^3

pend	end	start

