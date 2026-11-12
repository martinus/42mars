;redcode-lp
;name Biocular
;author Christian Schmidt
;strategy twin paper
;assert 1

len     equ     37;16
inc     equ     814;1727
zofs    equ     7483;2454
color   equ     4265;500
sAwa    equ     3855;500


from    mov     #len,   #len
scan    add.a   #inc,   to
        jmz.f   scan,   *to
loop    mov     <from,  {to
        jmn     loop,   from
        spl     from,   {color
to      jmz     zofs,   *0

for 50
dat 0, 0
rof

sGo   mov     <sBo,     {sBo
for 6
      mov     <sBo,     {sBo
rof
sBo   spl     from+sAwa, to+1
      jmp     from

end sGo

