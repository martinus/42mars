;redcode-94 verbose
;name Buffette Fang-Hunter
;author Robert Macrae
;strategy Scan for fang and attack source
;assert 1


; Linear scan for a fang; if I find one, launch a D-Clear just before it and hope to flatten
; the vampire.  If I don't, fall through to an unbooted version of the Olivia Imp-Stone. 



; ----- scan -----

scan	JMZ.f  #-300,  	}scan       	; scan preceding 200 locations for a fang
	SUB.ba {scan,   *0          	; scan now points to master fang or stores a 1 if none found
     	ADD.a  scan,   	bptr   		; boot a DClear to just before master fang   
	MOV.i  {bfrm, 	{bptr           ; ... boot even if I havent found anything to shorten code!
     	DJN    -1, 	#4  			;
bptr 	DJN.a	  -40,    	scan	    		; DJN so if I haven't found a fang I drop through to Olivia 


; Bootless Olivia 
; after Ben Ford

; No real thought to spacing, but imp gets to about 20 proc before being bombed.
; With only 250 proc may do better without double SPL on stone?

; ----- boot -----
bdst	equ	(spin+5223)

boot:	mov	rdat,		*bdst    ; ok, there is a vestigial boot.
 	spl 	spin, 	0


; ----- stone -----
rptr	equ	(rock-5)	; 
rbmb	equ	(rock+6)	; 
rinc	equ	(3315)	;
rclk	equ	(1599)	; 
rorg	equ	(rmov-rinc*rclk)
rdjn	equ	(rock-rinc)

bsrc:	spl	 #7,	     $0
rock:	spl	 #rinc,	<rdjn
rmov:	mov.i	 {rorg,	rhit-rorg
	add.f	 rock,	rmov
rhit:	djn.f	 rmov,	<rdjn
	mov.i	 rbmb,	>rptr
rend:	djn.f	   -1,	>rptr
rdat:	dat	 <2667,	#rend-rptr+4


; ----- imp launcher -----
ihop	equ	(2667)
iinc	equ	(-ihop-1)
idjn	equ	(ijmp+5800)
iorg	equ	(ijmp+1102)
ioff	equ	(iorg+iinc*2)

iimp:	mov.i	#iorg,	 ihop
spin:	spl	#0,	 	 $0
	sub.f	#iinc,	 ijmp
imov:	mov	 iimp,	 }iimp
ijmp:	djn.f	 ioff,	 {idjn


; ----- dclear -----

gate	EQU  (clr-2)

clr	MOD.a  #10,    #10       		; after executing once is #0, #10 so lethal         
bfrm 	SPL    #3,     >gate-1			
  	MOV    clr,    >gate
	DJN.f  -1,     >gate   

