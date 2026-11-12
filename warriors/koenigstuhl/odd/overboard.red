;redcode
;name overboard
;author Roy van Rijn
;assert 1

ptr     dat    >-20,    <20
dump    dat    >ptr2,   >ptr2
ptr2    dat   <-10,    >20
pointer dat    >1,     >-2
sOne    add.f  <-1,    }dump
        nop    }pointer,{dump
scan    sne    }ptr2,  >ptr2
        jmp    {pointer,>pointer
s       spl    >0,       <0
        mov    >bomb,    >ptr2
        mov    <bomb,    {ptr2
        jmp    {bomb,    >ptr2
bomb    dat    >s,       <-1
end sOne
