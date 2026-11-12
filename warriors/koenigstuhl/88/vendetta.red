;redcode
;name Vendetta
;author John Metcalf
;strategy replicating scanner
;assert CORESIZE==8000

length  equ    19
gap     equ    7
step    equ    2104
first   equ    (paper+step+14)

paper   mov    #length,      length
scan    add    #step+1,      sptr
        mov    bmb,          <sptr
sptr    jmz    scan,         <first+1
copy    mov    bmb,          <sptr
        mov    <paper,       <pgo
        jmn    copy,         paper
dest    spl    @paper,       <4000
pgo     jmz    @0,           6978
bmb     dat    <2667,        <1-gap

        end    scan

