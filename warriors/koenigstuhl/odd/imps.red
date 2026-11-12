;redcode-odd
;name Imps
;author Sascha Zapf
;assert CORESIZE==8000

; -- imp constants

iStp    equ    (2667)             ; 3-point imps
iSDc    equ    (-iStp-1)          ;
iHp1    equ    (iImp-2*(iStp+1))  ;
iHp2    equ    (iImp+2*iStp-1)    ;

; -- imp launcher

iPmp    spl    #iImp , #0
        sub.f  #iSDc ,  iJmp
        mov     iImp , }iPmp
iJmp    jmp     iHp1 , >iHp2
iImp    mov.i  #  10 , iStp

        end     iPmp
