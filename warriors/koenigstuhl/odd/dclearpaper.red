;redcode-odd
;name dclearpaper
;author Roy van Rijn
;assert 1

sGate   dat     0       ,       20

for 3
        dat     0       ,       0
rof

        spl     1
        mov     -1,0
        spl     1

        spl     @0      ,       70
        mov     }-1     ,       >-1
sStart  mov.i   sBmb    ,       >sGate
        djn.f   -1      ,       >sGate
sBmb    dat     <1      ,       >20

end sStart-5
