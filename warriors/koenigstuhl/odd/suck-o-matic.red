;redcode-94x
;name Suck-O-Matic
;author Sascha Zapf
;strategy First entry irct No.10
;strategy Kind of Vampire, moving Pointer, hoping hit a jmp or spl
;       CORESIZE==800
;assert 1

step1   EQU     170
step2   EQU     210

trap    dat.f   $0,$0
fang1   dat.f   $step1,$trap-step1
fang2   dat.f   $step2+5,$trap-5-step2
loop    mov.f   fang1, @fang1
        mov.f   fang2, @fang2
        nop     $0,$0                   ; Selfhit
        add.f   inkr1,fang1
        add.f   inkr2,fang2
        jmp     loop
for     5
        dat     0,0
rof
inkr1   dat.f   $step1,$-step1
inkr2   dat.f   $step2,$-step2

        end     loop

