;redcode-RF22
;name Pan Galactic Gargle Blaster
;author Chip Wendell
;strategy Two-component P^3 switcher
;strategy Components:
;strategy   Solo Process, by Roy van Rijn
;strategy   All Systems Normal, by Robert Hale
;strategy     (based on the stone from Aladdin's Cave)
;strategy   (both optimized for tiny LP core by Fizmo)
;strategy Hey, at least the p-brain is original (I think)!
;assert 1

	org think

;SoLo Process, by Roy van Rijn
tPtr   equ   (tWipe-7)
tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  #715     ,tPtr
	  sne.x  *tPtr    ,>tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,<tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
          djn    *pScan   ,#18

tSpl      spl    #0       ,}0
tClr      mov    tEnd     ,>tSelf
          djn.f  tClr     ,{tSelf
tEnd      dat    >1       ,2-tSelf

	for 8
          dat    0,0
	rof

;Two-component, 8-state P^3 switcher
PSTATE equ 30
think ldp.a      #0, in
      ldp.a #PSTATE, table
      mod.ba   *in, table
      stp.b  *table, #PSTATE

table jmp }0,    10 ; = ( 1*7) + 3 = ( 1*9) + 1 = ( 1*8) + 2 ;initial state
      dat ASN,  352 ; = (50*7) + 2 = (39*9) + 1 = (44*8) + 0
      dat ASN,  235 ; = (33*7) + 4 = (26*9) + 1 = (29*8) + 3
      dat ASN,  180 ; = (25*7) + 4 = (20*9) + 0 = (22*8) + 5
      dat Solo,  51 ; = ( 7*7) + 2 = ( 5*9) + 6 = ( 6*8) + 3
      dat Solo,  52 ; = ( 7*7) + 3 = ( 5*9) + 7 = ( 6*8) + 4
      dat Solo, 277 ; = (39*7) + 4 = (30*9) + 7 = (34*8) + 5
      dat Solo, 502 ; = (71*7) + 5 = (55*9) + 7 = (62*8) + 6

      dat ASN,   10 ; = ( 1*7) + 3 = ( 1*9) + 1 = ( 1*8) + 2 ;unreachable

in    dat 0, 7  ; must have non-zero b-field in the previous cell
      spl 1, 9
      spl 1, 8

Solo   mov dptr, tPtr
	jmp tScan+1
dptr	dat 94 ,736

;All Systems Normal, by Robert Hale
sStep	equ	357
pAwa	equ	686

ASN	
pGo  	    mov.i   Stone,     pGo+pAwa
          mov.i   Stone+1,   pGo+pAwa+1
          mov.i   Stone+2,   pGo+pAwa+2
          spl     pGo+pAwa

Stone     mov    	{328,1-sStep
          sub.x  	#sStep   ,-1
          jmp    	-2       ,}-2


