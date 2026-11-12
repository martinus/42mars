;redcode-94x
;name Mavin Manyshaped AX 116
;author Steve Gunnell
;strategy P^3 switcher -> dodger/stone/scanner
;assert 1

         org    pGo

;   --------------
; ----  Dodger  ----
;   --------------

iGate   equ    	(iClr-5)
iIMP	equ		47183

iScan   jmz.f  	#0         	, }iPtr
        nop    	}iPtr      	, }iPtr
iCopy   mov    	<iPtr      	, {iPtr
        djn    	iCopy      	, #4
iPtr    djn.f  	iWipe+6    	, #iWipe+1
        spl    	#0         	, {iGate
iClr    mov    	iWipe      	, >iGate
        djn.f  	iClr       	, >iGate
iWipe   dat    	<iIMP      	, iWipe+4-iGate
		dat.f	$0			, $0
		dat.f	$0			, $0
		dat.f	$0			, $0
		dat.f	$0			, $0

;   --------------
; ----  Stone   ----
;   --------------

cStep    equ    31832
cTime    equ    53759
cDjn     equ    9155

        spl    	#0         	, 0
cLoop   mov    	cBomb      	, @cPtr
cHit    add    	#2*cStep   	, cPtr
cPtr    mov    	cBomb      	, }cHit-cStep*cTime
        djn.f  	cLoop      	, <cDjn
		dat.f	$0			, $0
		dat.f	$0			, $0
		dat.f	$0			, $0
cBomb   dat    	cStep      	, >1
		dat.f	$0			, $0
		dat.f	$0			, $0
		dat.f	$0			, $0
		dat.f	$0			, $0

;   --------------
; ---- Scanner  ----
;   --------------

STEP  	equ  	17607
START 	equ  	0
IMPNUM	equ		49153

bptr  equ  head-2

head  	slt    	#START   	, #tail-(bptr)+5
      	mov.a  	head     	, bptr
trash 	mov    	*tail    	, }bptr
      	add.a  	#STEP    	, @hptr
      	jmz.f  	trash    	, *head
hptr  	jmn.a  	@hptr    	, head
      	jmp    	@hptr    	, }tail
tail  	dat.i #1 ,#1
      	spl #0, {0
eEnd  	mov.i #1, {1
		dat.f	$0			, $0
		dat.f	$0			, $0
		dat.f	$0			, pTab

;   --------------
; ---- Switcher ----
;   --------------

pLoc     equ    123

pDodger  equ    0
pStone   equ    (cBomb+1)-(iWipe+1)
pScanner equ    eEnd-(iWipe+1)
Offset   equ    2267

pGo      ldp.a  #0         , #pTab        ; 21 on win
         ldp.a  #pLoc      , pTab         ; 20 on loss
         mod.ba *pGo       , pTab         ; 19 on tie
         stp.b  *pTab      , #pLoc
         add.x  *pTab      , pPtr

         mov    @pPtr      , *pPtr
         mov    <pPtr      , {pPtr
         mov    <pPtr      , {pPtr
         mov    <pPtr      , {pPtr
         mov    <pPtr      , {pPtr
         mov    <pPtr      , {pPtr
         mov    <pPtr      , {pPtr
         mov    <pPtr      , {pPtr
         mov    <pPtr      , {pPtr
         mov    <pPtr      , {pPtr
pPtr     spl    *Offset    , iWipe+1
         sub.f   pPtr      ,  pPtr
         dat    0          , 0
         dat    0          , 0
         dat    0          , 0
         dat    0          , 0
                                          ;  S  L  W  T
pTab     dat    pDodger    , 4180         ;  0  1  0  0
         spl    #pDodger   , 4580         ;  1  2  0  1
         spl    #pDodger   , 4980         ;  2  3  0  2
         spl    #pDodger   , 5380         ;  3  4  0  3
         spl    #pStone    , 4184         ;  4  5  4  4
         spl    #pStone    , 4584         ;  5  6  4  5
         spl    #pStone    , 4585         ;  6  7  5  6
         spl    #pScanner  , 4187         ;  7  8  7  7
         spl    #pStone    , 5784         ;  8  9  4  8
         spl    #pStone    , 6184         ;  9 10  4  9
         spl    #pStone    , 6185         ; 10 11  5 10
         spl    #pScanner  , 11           ; 11 11 11 11

         end


