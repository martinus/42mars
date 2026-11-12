;redcode
;name Double Imp Boot
;author Roy van Rijn
;assert 1
; Before this gets lost somewhere on my HD, a different kind of imp.
; Launches both a and b imps from one launcher (with boot)

iStep   equ     2667
pStep   equ     ((iStep/2)+1)
bOff	equ	341

        mov 	iImp2		, <iPtr2
iPtr1   spl 	1		, iImp1+bOff
        mov 	iImp2		, <iPtr2
        mov 	iImp1		, <iPtr1
        mov 	{-2		, <iPtr1
        mov 	{-3		, <iPtr1
iPtr2	jmp	@iPtr1		, iImp1+pStep+bOff

for 10
dat 0,0
rof

iPmp    spl     #iImp1          , {iImp1+pStep
        add.f   #pStep          , iJmp
iJmp    jmp     iImp1-2*pStep, >iImp1+2*pStep-1
iImp1   mov.i   #iStep          , *0   ;a-imp
iImp2	mov.i	#0		, iStep   ;b-imp

end

