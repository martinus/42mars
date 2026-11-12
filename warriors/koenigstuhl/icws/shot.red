;redcode-icws
;name shot
;author John Metcalf
;strategy oneshot
;assert CORESIZE==8192

; almost identical to '88 test IV
; submitted to the KOTH.org ICWS hill on 11th June 2003

st    equ  -11
fi    equ  (175*11-3993)
boot  equ  (go-fi-100)

kill    dat <2731,    <-11

clear   spl 0,        <kill-sptr-8
cloop   mov @sloop,   <sptr
        mov @sloop,   <sptr
bomb    djn cloop,    <kill-5

steps   dat <st*3,    <st*3+1

sloop   add steps,    @cloop
        mov kill,     <sptr
sptr    cmp fi+st*2,  @fi+1
        jmp <sloop
e       jmp sloop

go      mov e, boot+10
a       for 10
        mov kill+10-a,<go
        rof                      
        jmp boot+7

        dd for MAXLENGTH-CURLINE
        dat <go*47*((dd-1)%11),<1
        rof

        end go

