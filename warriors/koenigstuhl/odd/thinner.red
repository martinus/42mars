;redcode-94nop
;name Thinner
;author Sascha Zapf
;strategy Stone/Paper
;assert CORESIZE==8000
;irct23

sOff    equ     3941
pHit0   equ     4939
pDst0   equ     7479
pDst1   equ     198
pDst2   equ     2390

pGo     spl     1       , }-500
qTab2   spl     1       , }-400
        spl     1       , }-300

pSilk0  spl     @0      , >pDst0
        mov     }pSilk0 , >pSilk0
pSilk1  spl     pDst1   , 0
        mov     >pSilk1 , }pSilk1
        mov     pBmb    , >pHit0
        mov     <pSilk1 , <pSilk2
pSilk2  djn.f   @0      , >pDst2
pBmb    dat     >5334   , >2667

for		9
		dat 0,0
rof

step    equ     6723
djnoff  equ	2817

start   
clr     spl     #0,     0
split	spl	#-step,	<step
stone	mov	>-step,	step+1
		add	split,  stone
cnt     djn.f	stone,	<djnoff
stptr   dat     0,0
		dat     0,0
cc      dat     0,      #x

launch	spl	pGo
		jmp	split

		end launch
