;redcode-irct33
;name IRCShot1
;author Christian Schmidt
;strategy .66c BiShot Scanner
;assert 1
;       CORESIZE==800

sOff    equ     (start1+2+40)

start1    add.f   #start9,     start9
start2    sne.i   *start9,     @start9
start3    djn.f   start1,      @start9
start4    djn.f   start11,     start9
start5    nop     0,           0
start6    nop     0,           0
start7    nop     0,           0
start8    jmp     start1,      0
start9    dat     sOff,        404+sOff
start10   dat     10,          410
start11   spl     #20,         -200
start12   mov     start11,     }start9
start13   mov     start11,     >start9
start14   djn.a   start12,     <start11
start15   nop     0,           0
start16   nop     0,           0
start17   nop     0,           0
start18   nop     0,           0
start19   nop     0,           0
nostart   jmp     start1,      0
          end start1
