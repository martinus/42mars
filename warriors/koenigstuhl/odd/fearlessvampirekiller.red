;redcode-94
;name The Fearless Vampire Killer
;author Christian Schmidt
;strategy .66c Bishot-style Scanner
;strategy with an anti-imp coreclear
;strategy Halloween Core War Tournament 2014
;assert 1

sSt     equ    5
gap     equ    12
cOff    equ    743

sOne    add.f   #sPtr,       sPtr
       sne.i   *sPtr,       @sPtr
       djn.f   sOne,        @sPtr
       djn.f   clear,       sPtr

for sSt
       dat     0,           0
rof

sPtr    dat    4009+cOff, {gap+cOff
jumper  jmp    4009,      gap
       dat    0,         0
       dat    0,         0
       jmp    7829,      <1143;2667
clear   spl    #4007,     gap
       mov    @switch,   >sPtr
       mov    jumper,    }sPtr
switch  djn    clear+1,   {clear

end sOne+1

