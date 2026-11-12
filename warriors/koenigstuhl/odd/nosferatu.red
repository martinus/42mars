;redcode
;name Nosferatu
;author Sascha Zapf
;assert CORESIZE==8000
;strategy First entry for the Multi-Maniacs-Round.
;strategy .5c Vampire/Stone, Coreclear and DJN-Stream

tstep	EQU     1704
ccgap   EQU	(incr-10)		
djgap   EQU     (fang+8)		
itarget EQU	trap+1-8-tstep  	
dtarget EQU	fang+8+tstep		

incr	dat	tstep+1, -tstep    	
loop	mov.i	fang,	 @fang
start	add.f	incr,    fang
	mov.i	incr,	 *fang
	jmp	loop,	 {fang	
fang	djn.f	itarget, >dtarget  	
trap	mov.i	incr, 	 <ccgap
	djn.b	trap,	 >djgap

	END start

