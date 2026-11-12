;redcode
;name self assured
;author Roy van Rijn
;assert 1

ptr     dat    >20,     <20
dump    dat    >ptr2,   >ptr2
ptr2    dat   <1030,    >10
pointer dat    >1,     >-1
sOne    add.f  <-1,    }dump
        nop    }pointer,{dump
scan    sne    }ptr2,  >ptr2
        jmp    {pointer,>pointer
s       spl    >0,       <0
        mov    >bomb,    >ptr2
        mov    <bomb,    }ptr2
        jmp    >1,       <1
        dat    >s,       >s
bomb    dat    >0,       <-1
end sOne
