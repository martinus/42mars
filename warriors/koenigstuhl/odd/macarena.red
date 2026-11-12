;redcode-94b
;name Macarena
;author Azúcar moreno
;strategy Some kind of Spanish tipical dance
;assert 1

one equ 1001
two equ 2235
three equ 2234
caramba equ 128

org aBailar

fiesta SPL     0,  <-one
        MOV     <21, two
        SUB     1,  -1
        DJN     -2, <-three  
aBailar SPL     fiesta, <caramba         
        ADD  2, 2
        SPL -1, < one
        DJN 25, {-75





