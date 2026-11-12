;redcode-94nop
;name April Fool
;strategy First version optimized
;author Roy van Rijn
;assert 1

example     dat     -1,      0   ;This is the .a djn-stream from the Sibling
                                 ;Not produced by Big Brother
                                 ;Only by the Sibling

sibling     jmp     -2,      }-2 ;If we locate this line
                                 ;We know we have the exact sibling line


gate        dat     cBomb,   3305

cAdd        sub.ab  #4687,   cScan
cScan       seq.i   example, 3520
            djn.b   cAdd,    >1379      ;quickly scan the core for the
djnstream
            sub     #1600,   cScan      ;If we find it, substract the
distance
            seq     @cScan,  sibling    ;Now we walk through the core
backwards
cIncr       jmp     -1,      <cScan             ;Until we find the sibling
            sub.ba  cScan,   1
            add.a   #9,      @cScan     ;Then we preform the vampire attack
            spl     #0,      <3447      ;->Join the Sibling in this
coreclear
            mov     *gate,   >gate
            mov     *gate,   >gate
            djn.f   -2,      <7142
            dat     #13,     >17
            spl     #13,     >17        ;Very simple SSD clear
cBomb       spl     #14,     >17        ;Should work just fine killing the

Brother

for         82
            dat     0,       1          ;Slow the paper down a bit
rof

end         cScan
