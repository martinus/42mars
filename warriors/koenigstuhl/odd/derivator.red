;*** Derivator explanation ***
;- deg must be sufficient more than the degree of the polynomial
;- count is the number of derivations
;- at the label d0 you put in the b-field the coefficient of x^0, at d1 the 
;coefficient of x^1 and so on.

;redcode-94
;name Derivator
;author Koen Struyve
;assert 1

deg equ 7
count equ 2
org start

start mov.i ptr-1, ptr
loop mul.b ptr, *ptr
mov.i }ptr, >ptr
seq.b ptr, #deg
jmp loop
djn start, #count
dat #2, #1
ptr dat #0, #0
d0 dat #0, #1
d1 dat #0, #3
d2 dat #0, #2
d3 dat #0, #4

