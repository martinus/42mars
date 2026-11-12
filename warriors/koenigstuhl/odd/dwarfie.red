;redcode-88
;name Dwarfie
;author Zul Nadzri
;strategy Round 18 Frenzy Tournament
;strategy Is this a trick round or what??! ;-)
;assert 1

dest1 equ 4300
dest2 equ dest1-2520-9
dest3	equ dest1+2520-14
gap	equ 18
space	equ -16

boot	mov a, dest1
	mov b, dest1
	mov c, dest1
	mov stun, dest1-gap
	spl dest1-4, <boot+3000
k	mov d, dest2
	mov e, dest2
	mov f, dest2
	mov bomb, dest2-gap
	spl dest2-4, <boot+3001
	mov g, dest3
	mov h, dest3
	mov i, dest3
	mov bomb, dest3-gap
	jmp dest3-4, <boot+3002

bomb	dat <-1, <1
stun	djn $0, #600
for 10+3
dat <1, <-1
rof
a	add #3044, 1
b	mov space, 2+2000
c	jmp -2, <-449
d	add #3044, 1
e	mov space, 2+2000-5216
f	jmp -2, <-449
g	add #3044, 1
h	mov space, 2+2000+4272-180
i	jmp -2, <-449

for MAXLENGTH-CURLINE
djn $0,#c
rof
end boot
;end k
