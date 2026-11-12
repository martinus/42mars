;redcode-94
;assert CORESIZE < (3*5*7*11*13*17)
;name Imp Construction Kit
;author David Moore
;strategy imp + clear

;---------------------------------------------------------------
; Given any prime number P such that P < CORESIZE, either
; P divides CORESIZE or P has a multiplicative inverse.
; In the latter case, there is a number I such that
; (P * I) % CORESIZE = 1 % CORESIZE.
;
; If such I exists, then you can make an imp spiral with P parts.
; The imp step size is I.
;
; For every core with size less than 510510,
; you can make an imp with 17 or fewer parts.
;
; 510510 is the first number that is divisible by every prime
; up to 17.
;
;	2 * 3 * 5 * 7 * 11 * 13 * 17  =  510510
;
; First, we find a prime that does not divide CORESIZE evenly.
; Then, we compute its multiplicative inverse. Knowing that,
; we can boot an imp launcher.
;
; Here's an iterative method for computing the multiplicative
; inverse of P:
;
; S_0  =  0
; R_0  =  CORESIZE
;
; S_1  =  1
; R_1  =  P  (P = any number that has a multiplicative inverse)
;
; S_2  =  -(CORESIZE / P)  =  -([(CORESIZE - P) / P] + 1)
; R_2  =  CORESIZE % P  =  (CORESIZE - P) % P
;
; S_N  =  S_(N-2) - S_(N-1) * (R_(N-2) / R_(N-1))
; R_N  =  R_(N-2) % R_(N-1)
;
; stop when R_N = 0 or R_N = 1
;
; if R_N = 1 then S_N is the multiplicative inverse of P
; if R_N = 0 then P does not have a multiplicative inverse
;
; For example, try P = 17 and CORESIZE = 8000
;
;	S_0 =    0
;	R_0 = 8000
;
;	S_1 =    1
;	R_1 =   17
;
;	S_2 = -470
;	R_2 =   10
;
;	S_3 =  471
;	R_3 =    7
;
;	S_4 = -941
;	R_4 =    3
;
;	S_5 = 2353
;	R_5 =    1
;
; 17 * 2353  =  40001  =  5 * 8000 + 1
;
; This method was based on Euclid's algorithm for finding
; the greatest common divisor (GCD) of two numbers.
; P has a multiplicative inverse in a core of size CORESIZE
; if and only if GCD(P, CORESIZE) = 1.
;
; For example, try Euclid's algorithm on 17 and 8000:
;
;	8000 = 470 * 17 + 10
;	  17 =   1 * 10 +  7
;	  10 =   1 *  7 +  3
;	   7 =   3 *  2 +  1
;	   3 =   3 *  1 +  0
;
; Multiply each side of each equation by the inverse of 17
; (call it 'I' since it is not yet known). Solve for I.
;
; (8000 * I) % 8000 = ((470 * 17 + 10) * I) % 8000
; 0 - (10 * I) % 8000 = (470 * (17 * I)) % 8000
; (-10 * I) % 8000 = (470 * 1) % 8000
; -470 % 8000 = (10 * I) % 8000
;
; (17 * I) % 8000 = ((1 * 10 + 7) * I) % 8000
; 1 % 8000 = (1 * (10 * I) + 7 * I) % 8000
; 1 % 8000 = (-470 + 7 * I) % 8000
; 471 % 8000 = (7 * I) % 8000
;
; (10 * I) % 8000 = ((1 * 7 + 3) * I) % 8000
; -470 % 8000 = (1 * 471 + 3 * I) % 8000
; -941 % 8000 = (3 * I) % 8000
;
; (7 * I) % 8000 = ((3 * 2 + 1) * I) % 8000
; 471 % 8000 = (2 * (3 * I) + 1 * I) % 8000
; 471 % 8000 = (2 * (-941) + I) % 8000
; 2353 % 8000 = I % 8000
;
; P * I  =  17 * 2353  =  40001  =  5 * 8000 + 1
;---------------------------------------------------------------

org start

R_2	dat  0, 200+1
R_1	dat  0, 200
R	dat  0, 200

S_2	dat  0, 300+1
S_1	dat  0, 300
S	dat  0, 300

	dat -17, 17
	dat -13, 13
	dat -11, 11
	dat - 7,  7
	dat - 3,  3
primes	dat - 5,  5

; find a prime that doesn't divide CORESIZE

start	mod.ba {calc, *calc
	jmz.a -1, *calc

; now compute its multiplicative inverse

calc	mov.b primes+1, @R_1
	mov.ab	  #1, >S_1
	mov.ab	  #0, @R
	sub	@R_1, @R
	mov.b	@R  , @S
	div.b	@R_1, @S
	add.ab	  #1, @S
	mul.ab	 #-1, >S
	jmp	skip,  0

iter	mov.b	@R_2, @S
	div.b	@R_1, @S
	mul.b	>S_1, @S
	mul.ab	 #-1, @S
	add.b	>S_2, >S
	mov.b	>R_2, @R
skip	mod.b   >R_1, @R
	slt.b	>R  , #2
	jmp	iter,  0

	mov.b	<S, impy   ; finally, the imp step is known

; set up imp launcher and clear

	add.ba impy, adder
	sub.a adder, jumper

	div.a #2, db   ; target 2 point imps
	add.a #2, db   ; this is why I don't make 'em

	div.a  #2, bptr    ; boot clear halfway around core
	add.ab bptr, cp
	sub.ba impy, cp

	spl boot2, 0
	spl 1, 0
	spl 1, 0
	mov <dclear, {bptr
	mov <launch, {cptr
bptr	jmp -1, 0

boot2	add.a bptr, cptr
	sub.ba impy, cptr   ; boot launcher one imp step away from clear
	mov   impy, {cptr
cp	mov.ab #100, bptr-7
cptr	jmp bptr-1, 0

; clear

dclear	spl #0, 4
	mov.i  2, >-4
	djn.f -1, >-5
db	dat  <-2,  12

; imp launcher

launch	spl #0, 4
	mov impy, >jumper
adder	add.a #1, 1
jumper	jmp 2 + impy + 20, impy + 20
impy	mov.i #6, 1

end

